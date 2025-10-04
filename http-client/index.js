/**
    Cookie Jar
*/
const tough = require('tough-cookie');

/**
    Connection
*/
let client;

process.on('error', (e) => {
    console.error(e);
})

let established = false;
const establishConnection = async () => {
    const grpcClient = require('./src/process');
    client = require('./src/connection')(await grpcClient());
    established = true;
};

/**
   Query String Formatting
*/
const serialize = function (obj) {
    let str = [];
    for (var p in obj)
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
        }
    return str.join('&');
};

const request = async (options) => {
    // Establish connection
    if (!established) {
        await establishConnection();
    }

    // Body => Object if "application/json"
    if (options.json) {
        try {
            options.body = JSON.stringify(options.body);
            options.headers['content-type'] = 'application/json';
        } catch {
            // Failed
        }
    }

    // Query String
    if (options.qs) {
        if (options.url.includes('?')) {
            if (options.url.slice(-1) !== '&') {
                options.url += '&' + serialize(options.qs);
            } else {
                options.url += serialize(options.qs);
            }
        } else {
            options.url += '?' + serialize(options.qs);
        }
    }

    // Cookie Jar
    if (options.jar) {
        const cookieString = await options.jar.getCookieString(options.url);
        if (cookieString !== '') options.headers.cookie = cookieString;
    }

    const response = await client(options);

    if (response.headers['set-cookie']) {
        const cookies = response.headers['set-cookie'];

        for (const cookie of cookies) {
            try {
                options.jar.setCookie(cookie, options.url);
            } catch {
                // Failed setting cookie
            }
        }
    }

    // Parses body if json: true
    if (options.json) {
        try {
            response.body = JSON.parse(response.body);
        } catch {
            // Body isn't a object
        }
    }

    return response;
};

module.exports = {
    CookieJar: new tough.CookieJar(),
    request,
};
