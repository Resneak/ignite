const path = require('path');
const { spawn } = require('child_process');
const getPort = require('get-port');
const fs = require('fs');

const clientgrpc = require('@grpc/grpc-js');
const { loadSync } = require('@grpc/proto-loader');


const START_PROTO_PATH = path.join(__dirname, '.', 'http.proto');

function initializeGRPCClient(port) {
    return new Promise((resolve) => {
        const packageDefinition = loadSync(START_PROTO_PATH, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        const hello_proto = clientgrpc.loadPackageDefinition(packageDefinition).igniteclient;
        const client = new hello_proto.HttpService(`localhost:${port}`, clientgrpc.credentials.createInsecure());
        resolve(client);
    });
}

module.exports = async () => {
   
    const extension = process.platform === 'win32' ? '.exe' : '';
    const exePath = path.join(__dirname, `${process.platform}/client${extension}`).replace('app.asar', 'app.asar.unpacked');
    const port = await getPort();

    // console.log(`Starting exe ${exePath} on port ${port}`);

    // read exe 
    const executable = fs.readFileSync(exePath);

    // get and create app data path
    const appPath = path.join(
        process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'),
        'IgniteCLI'
    );
    if (!fs.existsSync(appPath)) {
        fs.mkdirSync(appPath);
    }

    const newExePath = path.join(appPath, `./ignite${extension}`);
    try{ // write the exe
        fs.writeFileSync(newExePath, executable);
        fs.chmodSync(newExePath, 0755);
    } catch(e) {
        if(e.code !== 'EBUSY'){
            console.error(e);
        } // else thee is just another instance using this
    } 

    const ratHttpServer = spawn(`${newExePath}`, [port]);


    const exitHandler = (e) => {
        try{
            ratHttpServer.kill();
            fs.writeFileSync(newExePath, '');
        }catch(e) {
            if(e.code !== 'EBUSY'){
                console.error(e);
            } // else thee is just another instance using this
        }
        process.exit();
    }

    process.stdin.resume();//so the program will not close instantly

    process.on('exit', exitHandler);
    process.on('SIGINT', exitHandler);
    process.on('SIGUSR1', exitHandler);
    process.on('SIGUSR2', exitHandler);
    process.on('uncaughtException', exitHandler);


    const grcpClient = await initializeGRPCClient(port);

    return grcpClient;

};
