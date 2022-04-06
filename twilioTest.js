#!/usr/bin/env node

import { LinuxImpulseRunner, Imagesnap, Ffmpeg, ICamera, ImageClassifier } from "edge-impulse-linux";
import express = require('express');
import http from 'http';
import socketIO from 'socket.io';
import Path from 'path';
import sharp from 'sharp';
import { Twilio } from 'twilio';

if (!process.env.TWILIO_ACCOUNT_SID) {
    console.error('Missing "TWILIO_ACCOUNT_SID" environmental variable');
    process.exit(1);
}
if (!process.env.TWILIO_AUTH_TOKEN) {
    console.error('Missing "TWILIO_AUTH_TOKEN" environmental variable');
    process.exit(1);
}
if (!process.env.TWILIO_FROM) {
    console.error('Missing "TWILIO_FROM" environmental variable');
    process.exit(1);
}
if (!process.env.TWILIO_TO) {
    console.error('Missing "TWILIO_TO" environmental variable');
    process.exit(1);
}

// tslint:disable-next-line: no-floating-promises
(async () => {
    try {
        if (!process.argv[2]) {
            console.log('Missing one argument (model file)');
            process.exit(1);
        }

        let runner = new LinuxImpulseRunner(process.argv[2]);
        let model = await runner.init();

        console.log('Starting the image classifier for',
            model.project.owner + ' / ' + model.project.name, '(v' + model.project.deploy_version + ')');
        console.log('Parameters', 'image size',
            model.modelParameters.image_input_width + 'x' + model.modelParameters.image_input_height + ' px (' +
            model.modelParameters.image_channel_count + ' channels)', 'classes', model.modelParameters.labels);

        // select a camera... you can implement this interface for other targets :-)
        let camera: ICamera;
        if (process.platform === 'darwin') {
            camera = new Imagesnap();
        }
        else if (process.platform === 'linux') {
            camera = new Ffmpeg(process.env.VERBOSE === '1' /* verbose */);
        }
        else {
            throw new Error('Unsupported platform "' + process.platform + '"');
        }
        await camera.init();
        const devices = await camera.listDevices();
        if (devices.length === 0) {
            throw new Error('Cannot find any webcams');
        }
        if (devices.length > 1 && !process.argv[3]) {
            throw new Error('Multiple cameras found (' + devices.map(n => '"' + n + '"').join(', ') + '), add ' +
                'the camera to use to this script (node build/webserver-twilio.js model.eim cameraname)');
        }
        let device = process.argv[3] || devices[0];

        console.log('Using camera', device, 'starting...');

        await camera.start({
            device: device,
            intervalMs: 100,
        });

        camera.on('error', error => {
            console.log('camera error', error);
        });

        console.log('Connected to camera');

        let imageClassifier = new ImageClassifier(runner, camera);
        await imageClassifier.start();

        startWebServer(model, camera, imageClassifier);
    }
    catch (ex) {
        console.error(ex);
        process.exit(1);
    }
})();

function startWebServer(model: {
    project: { name: string, owner: string },
    modelParameters: { image_channel_count: number, image_input_width: number, image_input_height: number }
}, camera: ICamera, imageClassifier: ImageClassifier) {
    const app = express();
    app.use(express.static(Path.join(__dirname, '..', 'public')));

    const server = new http.Server(app);
    const io = socketIO(server);

    const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID || '', process.env.TWILIO_AUTH_TOKEN || '');
    let lastSentMessage = 0;

    server.listen(Number(process.env.PORT) || 4911, process.env.HOST || '0.0.0.0', async () => {
        console.log('Server listening on http://localhost:' + (Number(process.env.PORT) || 4911));
    });

    // you can also get the actual image being classified from 'imageClassifier.on("result")',
    // but then you're limited by the inference speed.
    // here we get a direct feed from the camera so we guarantee the fps that we set earlier.
    camera.on('snapshot', async (data) => {
        let img;
        if (model.modelParameters.image_channel_count === 3) {
            img = sharp(data).resize({
                height: model.modelParameters.image_input_height,
                width: model.modelParameters.image_input_width
            });
        }
        else {
            img = sharp(data).resize({
                height: model.modelParameters.image_input_height,
                width: model.modelParameters.image_input_width
            }).toColourspace('b-w');
        }

        io.emit('image', {
            img: 'data:image/jpeg;base64,' + (await img.jpeg().toBuffer()).toString('base64')
        });
    });

    imageClassifier.on('result', async (result, timeMs, imgAsJpg) => {
        let r = result.result;

        if (r.bounding_boxes) {
            let bb: { width: number, height: number, x: number, y: number, value: number, label: string }[] = [];
            for (let b of r.bounding_boxes.filter(x => x.value >= 0.5)) {
                    bb.push(b);
            }
            r.bounding_boxes = bb;
            let emptycount = r.bounding_boxes.filter(x => x.label === 'seatempty').length;
            let takencount = r.bounding_boxes.filter(x => x.label === 'seattaken').length;
            let totalChairs = emptycount+takencount;    //Max Chairs in the Room


            if (bb.find(x => x.label === 'seattaken')) {
                if(takencount >= totalChairs){
                    console.log('Room is Full');
                    takencount = totalChairs;
                }
                else {
                    console.log('Room is Partially Occupied');
                }
                console.log("Empty Seats detected: " + emptycount);
                console.log("Taken Seats detected: " + takencount);
                console.log("Occupancy: " + takencount+ "/" + totalChairs);
                console.log("\n");


                // if last sent message >30 sec. ago?
                if (Date.now() > lastSentMessage + 10000) {
                    lastSentMessage = Date.now();
                    try {
                        if(takencount >= totalChairs){
                            await twilioClient.messages.create({
                                body: '\nRoom is Full\nEmpty Seats detected: ' +emptycount+"\nTaken Seats detected: " +takencount+"\nOccupancy: " + takencount+"/" + totalChairs,
                                to: process.env.TWILIO_TO || '',
                                from: process.env.TWILIO_FROM || ''
                            });
                        }
                        else{
                            await twilioClient.messages.create({
                                body: '\nRoom is Partially Occupied\n'+'Empty Seats detected: ' + emptycount+"\nTaken Seats detected: " +takencount+"\nOccupancy: " + takencount+"/" + totalChairs,
                                to: process.env.TWILIO_TO || '',
                                from: process.env.TWILIO_FROM || ''
                            });
                        }
                    }
                    catch (ex2) {
                        let ex = <Error>ex2;
                        console.warn('Failed to send a message via Twilio', ex.message || ex.toString());
                    }
                }
            }


            //only seatenmpty
            else if (bb.find(x => x.label === 'seatempty')) {
                console.log('Room is Empty');
                console.log("Empty Seats detected: " + emptycount);
                console.log("Taken Seats detected: " + takencount);
                console.log("Occupancy: " + takencount+ "/" + totalChairs);
                console.log("\n");

                // if last sent message >30 sec. ago?
                if (Date.now() > lastSentMessage + 10000) {
                    lastSentMessage = Date.now();
                    try {
                        await twilioClient.messages.create({
                            body: '\nRoom is empty\nEmpty Seats detected: ' +emptycount+"\nTaken Seats detected: " +takencount+"\nOccupancy: " + takencount+"/" + totalChairs,
                            to: process.env.TWILIO_TO || '',
                            from: process.env.TWILIO_FROM || ''
                        });
                    }
                    catch (ex2) {
                        let ex = <Error>ex2;
                        console.warn('Failed to send a message via Twilio', ex.message || ex.toString());
                    }
                }
            }
        }


        io.emit('classification', {
            result: result.result,
            timeMs: timeMs,
        });
    });

    io.on('connection', socket => {
        socket.emit('hello', {
            projectName: model.project.owner + ' / ' + model.project.name
        });
    });
}