const defaultOptions = {
    method: 'GET',
    headers: {},
};

let client;

const headersToOrder = (obj) => {
    return Object.keys(obj);
};

let isReady = false;

const Request = async (options) => {
    return new Promise(async (resolve) => {
        if (!isReady) {
            await new Promise((resolve) => {
                const check = setInterval(() => {
                    if (client.getChannel().getConnectivityState(true)) {
                        isReady = true;
                        resolve();
                        clearInterval(check);
                    }
                }, 300);
            });
        }

        options = { ...defaultOptions, ...options };

        if (options.headers) {
            options.headerOrder = headersToOrder(options.headers);
        }

        options.headers = Object.entries(options.headers).map(([key, value]) => ({ key, value }));

        // options.useCachedClient = typeof options.useCachedClient === 'undefined' ? true : options.useCachedClient;

        try {
            client.SendRequest(options, (err, res) => {
                if (err) throw new Error(err.message);

                try {
                    headers = {};
                    try {
                        headers = JSON.parse(res.headers);
                    } catch {
                        // continue
                    }

                    const parsedHeaders = {};
                    for (let [key, value] of Object.entries(headers)) {
                        key = key.toLowerCase();
                        parsedHeaders[key] = key !== 'set-cookie' ? value.join() : value;
                    }

                    const responseObj = {
                        body: !res.success && res.error ? res.error : res.body,
                        headers: parsedHeaders,
                        statusCode: res.status || -1,
                        success: res.success,
                    };

                    try {
                        if (
                            typeof res.headers === 'object' &&
                            responseObj.headers['Content-Type'] &&
                            responseObj.headers['Content-Type'].join('').includes('application/json') &&
                            responseObj.body.length
                        ) {
                            responseObj.body = JSON.parse(responseObj.body);
                        }
                    } catch {
                        // continue
                    }

                    resolve(responseObj);
                } catch (e) {
                    // console.log(e);
                    resolve(e);
                }
            });
        } catch (e) {
            console.error('error sending request', e);
        }
    });
};

module.exports = (grpcClient) => {
    client = grpcClient;

    return Request;
};
