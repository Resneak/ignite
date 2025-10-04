
const _dataMMT = {
    mimeTypes: [
        {
            type: 'application/pdf',
            suffixes: 'pdf',
            description: '',
            __pluginName: 'Chrome PDF Viewer',
        },
        {
            type: 'application/x-google-chrome-pdf',
            suffixes: 'pdf',
            description: 'Portable Document Format',
            __pluginName: 'Chrome PDF Plugin',
        },
        {
            type: 'application/x-nacl',
            suffixes: '',
            description: 'Native Client Executable',
            __pluginName: 'Native Client',
        },
        {
            type: 'application/x-pnacl',
            suffixes: '',
            description: 'Portable Native Client Executable',
            __pluginName: 'Native Client',
        },
    ],
    plugins: [
        {
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format',
            __mimeTypes: ['application/x-google-chrome-pdf'],
        },
        {
            name: 'Chrome PDF Viewer',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            description: '',
            __mimeTypes: ['application/pdf'],
        },
        {
            name: 'Native Client',
            filename: 'internal-nacl-plugin',
            description: '',
            __mimeTypes: ['application/x-nacl', 'application/x-pnacl'],
        },
    ],
};

// ===========================
// ||         UTILS         ||
// ===========================
let _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils = {};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.replaceProperty = (obj, propName, descriptorOverrides = {}) => {
    return Object.defineProperty(obj, propName, {
        ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),
        ...descriptorOverrides,
    });
};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.makeNativeString = (name = '') => {
    return (Function.toString + '').replace('toString', name || '');
};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.stripProxyFromErrors = (handler = {}) => {
    const newHandler = {};
    // We wrap each trap in the handler in a try/catch and modify the error stack if they throw
    const traps = Object.getOwnPropertyNames(handler);
    traps.forEach((trap) => {
        newHandler[trap] = function () {
            try {
                return handler[trap].apply(this, arguments || []);
            } catch (err) {
                if (!err || !err.stack || !err.stack.includes(`at `)) throw err;

                const stripWithBlacklist = (stack) => {
                    const blacklist = [
                        `at Reflect.${trap} `, // e.g. Reflect.get or Reflect.apply
                        `at Object.${trap} `, // e.g. Object.get or Object.apply
                        `at Object.newHandler.<computed> [as ${trap}] `, // caused by this very wrapper :-)
                    ];
                    return (
                        err.stack
                            .split('\n')
                            // Always remove the first (file) line in the stack (guaranteed to be our proxy)
                            .filter((line, index) => index !== 1)
                            // Check if the line starts with one of our blacklisted strings
                            .filter((line) => !blacklist.some((bl) => line.trim().startsWith(bl)))
                            .join('\n')
                    );
                };

                const stripWithAnchor = (stack) => {
                    const stackArr = stack.split('\n');
                    const anchor = `at Object.newHandler.<computed> [as ${trap}] `; // Known first Proxy line in chromium
                    const anchorIndex = stackArr.findIndex((line) => line.trim().startsWith(anchor));
                    if (anchorIndex === -1) return false; // 404, anchor not found
                    // Strip everything from the top until we reach the anchor line
                    // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. `TypeError`)
                    stackArr.splice(1, anchorIndex);
                    return stackArr.join('\n');
                };

                // Try using the anchor method, fallback to blacklist if necessary
                err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack);

                throw err; // Re-throw our now sanitized error
            }
        };
    });
    return newHandler;
};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.redirectToString = (proxyObj, originalObj) => {
    const toStringProxy = new Proxy(Function.prototype.toString, {
        apply: function (target, ctx) {
            // This fixes e.g. `HTMLMediaElement.prototype.canPlayType.toString + ""`
            if (ctx === Function.prototype.toString) return _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.makeNativeString('toString');

            // `toString` targeted at our proxied Object detected
            if (ctx === proxyObj) {
                const fallback = () =>
                    originalObj && originalObj.name
                        ? _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.makeNativeString(originalObj.name)
                        : _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.makeNativeString(proxyObj.name);

                // Return the toString representation of our original object if possible
                return originalObj + '' || fallback();
            }

            // Check if the toString protype of the context is the same as the global prototype,
            // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect` test case
            const hasSameProto = Object.getPrototypeOf(Function.prototype.toString).isPrototypeOf(ctx.toString); // eslint-disable-line no-prototype-builtins
            if (!hasSameProto) return ctx.toString(); // Pass the call on to the local Function.prototype.toString instead

            return target.call(ctx);
        },
    });
    _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.replaceProperty(Function.prototype, 'toString', {
        value: toStringProxy,
    });
};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.replaceWithProxy = (obj, propName, handler) => {
    const originalObj = obj[propName];
    const proxyObj = new Proxy(obj[propName], _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.stripProxyFromErrors(handler));

    _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.replaceProperty(obj, propName, { value: proxyObj });
    _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.redirectToString(proxyObj, originalObj);

    return true;
};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.stringifyFns = (fnObj = { hello: () => 'world' }) => {
    function fromEntries(iterable) {
        return [...iterable].reduce((obj, [key, val]) => {
            obj[key] = val;
            return obj;
        }, {});
    }
    return (Object.fromEntries || fromEntries)(
        Object.entries(fnObj)
            .filter(([key, value]) => typeof value === 'function')
            .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval
    );
};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.materializeFns = (fnStrObj = { hello: "() => 'world'" }) => {
    return Object.fromEntries(
        Object.entries(fnStrObj).map(([key, value]) => {
            if (value.startsWith('function')) {
                // some trickery is needed to make oldschool functions work :-)
                return [key, eval(`() => ${value}`)()]; // eslint-disable-line no-eval
            } else {
                // arrow functions just work
                return [key, eval(value)]; // eslint-disable-line no-eval
            }
        })
    );
};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.createProxy = (pseudoTarget, handler) => {
    const proxyObj = new Proxy(pseudoTarget, _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.stripProxyFromErrors(handler));
    _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.patchToString(proxyObj);

    return proxyObj;
};

_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.patchToString = (obj, str = '') => {
    const toStringProxy = new Proxy(Function.prototype.toString, {
        apply: function (target, ctx) {
            // This fixes e.g. `HTMLMediaElement.prototype.canPlayType.toString + ""`
            if (ctx === Function.prototype.toString) {
                return _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.makeNativeString('toString');
            }
            // `toString` targeted at our proxied Object detected
            if (ctx === obj) {
                // We either return the optional string verbatim or derive the most desired result automatically
                return str || _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.makeNativeString(obj.name);
            }
            // Check if the toString protype of the context is the same as the global prototype,
            // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect` test case
            const hasSameProto = Object.getPrototypeOf(Function.prototype.toString).isPrototypeOf(ctx.toString); // eslint-disable-line no-prototype-builtins
            if (!hasSameProto) {
                // Pass the call on to the local Function.prototype.toString instead
                return ctx.toString();
            }
            return target.call(ctx);
        },
    });
    _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.replaceProperty(Function.prototype, 'toString', {
        value: toStringProxy,
    });
};

Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
});

Object.defineProperty(navigator, 'language', {
    get: () => 'en-US',
});

const generateMimeTypeArray = (_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils, fns) => (mimeTypesData) => {
    return fns.generateMagicArray(_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils, fns)(
        mimeTypesData,
        MimeTypeArray.prototype,
        MimeType.prototype,
        'type'
    );
};

const generatePluginArray = (_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils, fns) => (pluginsData) => {
    return fns.generateMagicArray(_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils, fns)(pluginsData, PluginArray.prototype, Plugin.prototype, 'name');
};

const generateMagicArray = (_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils, fns) =>
    function (dataArray = [], proto = MimeTypeArray.prototype, itemProto = MimeType.prototype, itemMainProp = 'type') {
        // Quick helper to set props with the same descriptors vanilla is using
        const defineProp = (obj, prop, value) =>
            Object.defineProperty(obj, prop, {
                value,
                writable: false,
                enumerable: false, // Important for mimeTypes & plugins: `JSON.stringify(navigator.mimeTypes)`
                configurable: true,
            });

        // Loop over our fake data and construct items
        const makeItem = (data) => {
            const item = {};
            for (const prop of Object.keys(data)) {
                if (prop.startsWith('__')) {
                    continue;
                }
                defineProp(item, prop, data[prop]);
            }
            return patchItem(item, data);
        };

        const patchItem = (item, data) => {
            let descriptor = Object.getOwnPropertyDescriptors(item);

            // Special case: Plugins have a magic length property which is not enumerable
            // e.g. `navigator.plugins[i].length` should always be the length of the assigned mimeTypes
            if (itemProto === Plugin.prototype) {
                descriptor = {
                    ...descriptor,
                    length: {
                        value: data.__mimeTypes.length,
                        writable: false,
                        enumerable: false,
                        configurable: true, // Important to be able to use the ownKeys trap in a Proxy to strip `length`
                    },
                };
            }

            // We need to spoof a specific `MimeType` or `Plugin` object
            const obj = Object.create(itemProto, descriptor);

            // Virtually all property keys are not enumerable in vanilla
            const blacklist = [...Object.keys(data), 'length', 'enabledPlugin'];
            return new Proxy(obj, {
                ownKeys(target) {
                    return Reflect.ownKeys(target).filter((k) => !blacklist.includes(k));
                },
                getOwnPropertyDescriptor(target, prop) {
                    if (blacklist.includes(prop)) {
                        return undefined;
                    }
                    return Reflect.getOwnPropertyDescriptor(target, prop);
                },
            });
        };

        const magicArray = [];

        // Loop through our fake data and use that to create convincing entities
        dataArray.forEach((data) => {
            magicArray.push(makeItem(data));
        });

        // Add direct property access  based on types (e.g. `obj['application/pdf']`) afterwards
        magicArray.forEach((entry) => {
            defineProp(magicArray, entry[itemMainProp], entry);
        });

        // This is the best way to fake the type to make sure this is false: `Array.isArray(navigator.mimeTypes)`
        const magicArrayObj = Object.create(proto, {
            ...Object.getOwnPropertyDescriptors(magicArray),

            // There's one ugly quirk we unfortunately need to take care of:
            // The `MimeTypeArray` prototype has an enumerable `length` property,
            // but headful Chrome will still skip it when running `Object.getOwnPropertyNames(navigator.mimeTypes)`.
            // To strip it we need to make it first `configurable` and can then overlay a Proxy with an `ownKeys` trap.
            length: {
                value: magicArray.length,
                writable: false,
                enumerable: false,
                configurable: true, // Important to be able to use the ownKeys trap in a Proxy to strip `length`
            },
        });

        // Generate our functional function mocks :-)
        const functionMocks = fns.generateFunctionMocks(_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils)(proto, itemMainProp, magicArray);

        // We need to overlay our custom object with a JS Proxy
        const magicArrayObjProxy = new Proxy(magicArrayObj, {
            get(target, key = '') {
                // Redirect function calls to our custom proxied versions mocking the vanilla behavior
                if (key === 'item') {
                    return functionMocks.item;
                }
                if (key === 'namedItem') {
                    return functionMocks.namedItem;
                }
                if (proto === PluginArray.prototype && key === 'refresh') {
                    return functionMocks.refresh;
                }
                // Everything else can pass through as normal
                return ReflectMock.get(...arguments);
            },
            ownKeys(target) {
                // There are a couple of quirks where the original property demonstrates "magical" behavior that makes no sense
                // This can be witnessed when calling `Object.getOwnPropertyNames(navigator.mimeTypes)` and the absense of `length`
                // My guess is that it has to do with the recent change of not allowing data enumeration and this being implemented weirdly
                // For that reason we just completely fake the available property names based on our data to match what regular Chrome is doing
                // Specific issues when not patching this: `length` property is available, direct `types` props (e.g. `obj['application/pdf']`) are missing
                const keys = [];
                const typeProps = magicArray.map((mt) => mt[itemMainProp]);
                typeProps.forEach((_, i) => keys.push(`${i}`));
                typeProps.forEach((propName) => keys.push(propName));
                return keys;
            },
            getOwnPropertyDescriptor(target, prop) {
                if (prop === 'length') {
                    return undefined;
                }
                return Reflect.getOwnPropertyDescriptor(target, prop);
            },
        });

        return magicArrayObjProxy;
    };

const generateFunctionMocks = (_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils) => (proto, itemMainProp, dataArray) => ({
    item: _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.createProxy(proto.item, {
        apply(target, ctx, args) {
            if (!args.length) {
                throw new TypeError(`Failed to execute 'item' on '${proto[Symbol.toStringTag]}': 1 argument required, but only 0 present.`);
            }
            return (isInteger ? dataArray[Number(args[0])] : dataArray[0]) || null;
        },
    }),
    namedItem: _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.createProxy(proto.namedItem, {
        apply(target, ctx, args) {
            if (!args.length) {
                throw new TypeError(`Failed to execute 'namedItem' on '${proto[Symbol.toStringTag]}': 1 argument required, but only 0 present.`);
            }
            return dataArray.find((mt) => mt[itemMainProp] === args[0]) || null;
        },
    }),
    refresh: proto.refresh
        ? _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.createProxy(proto.refresh, {
              apply(target, ctx, args) {
                  return undefined;
              },
          })
        : undefined,
});

const chrome = {
    app: {
        isInstalled: false,
        InstallState: {
            DISABLED: 'disabled',
            INSTALLED: 'installed',
            NOT_INSTALLED: 'not_installed',
        },
        RunningState: {
            CANNOT_RUN: 'cannot_run',
            READY_TO_RUN: 'ready_to_run',
            RUNNING: 'running',
        },
    },
    runtime: {
        OnInstalledReason: {
            CHROME_UPDATE: 'chrome_update',
            INSTALL: 'install',
            SHARED_MODULE_UPDATE: 'shared_module_update',
            UPDATE: 'update',
        },
        OnRestartRequiredReason: {
            APP_UPDATE: 'app_update',
            OS_UPDATE: 'os_update',
            PERIODIC: 'periodic',
        },
        PlatformArch: {
            ARM: 'arm',
            MIPS: 'mips',
            MIPS64: 'mips64',
            X86_32: 'x86-32',
            X86_64: 'x86-64',
        },
        PlatformNaclArch: {
            ARM: 'arm',
            MIPS: 'mips',
            MIPS64: 'mips64',
            X86_32: 'x86-32',
            X86_64: 'x86-64',
        },
        PlatformOs: {
            ANDROID: 'android',
            CROS: 'cros',
            LINUX: 'linux',
            MAC: 'mac',
            OPENBSD: 'openbsd',
            WIN: 'win',
        },
        RequestUpdateCheckStatus: {
            NO_UPDATE: 'no_update',
            THROTTLED: 'throttled',
            UPDATE_AVAILABLE: 'update_available',
        },
    },
};

Object.defineProperty(window, 'chrome', {
    get: () => chrome,
});

window.chrome = chrome;

let ReflectMock = {
    get: Reflect.get.bind(Reflect),
    apply: Reflect.apply.bind(Reflect),
};

const handler = {
    apply: function (target, ctx, args) {
        const param = (args || [])[0];

        if (param && param.name && param.name === 'notifications') {
            const result = { state: Notification.permission };
            Object.setPrototypeOf(result, PermissionStatus.prototype);
            return Promise.resolve(result);
        }

        // change this kek
        return ReflectMock.apply(...arguments);
    },
};

// Not enabling the permissions evasion since it doesn't seem
// like it's enabled in my chrome

// _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.replaceWithProxy(
// 	window.navigator.permissions.__proto__, // eslint-disable-line no-proto
// 	"query",
// 	handler
// );

['height', 'width'].forEach((property) => {
    // store the existing descriptor
    const imageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, property);

    // redefine the property with a patched descriptor
    Object.defineProperty(HTMLImageElement.prototype, property, {
        ...imageDescriptor,
        get: function () {
            // return an arbitrary non-zero dimension if the image failed to load
            if (this.complete && this.naturalHeight == 0) return 20;

            // otherwise, return the actual dimension
            return imageDescriptor.get.apply(this);
        },
    });
});

function mockPluginsAndMimeTypes({ fns, _dataMMT }) {
    fns = _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.materializeFns(fns);

    const mimeTypes = fns.generateMimeTypeArray(_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils, fns)(_dataMMT.mimeTypes);
    const plugins = fns.generatePluginArray(_b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils, fns)(_dataMMT.plugins);

    // Plugin and MimeType cross-reference each other, let's do that now
    // Note: We're looping through `data.plugins` here, not the generated `plugins`
    for (const pluginData of _dataMMT.plugins) {
        pluginData.__mimeTypes.forEach((type, index) => {
            plugins[pluginData.name][index] = mimeTypes[type];

            Object.defineProperty(plugins[pluginData.name], type, {
                value: mimeTypes[type],
                writable: false,
                enumerable: false, // Not enumerable
                configurable: true,
            });
            Object.defineProperty(mimeTypes[type], 'enabledPlugin', {
                value: new Proxy(plugins[pluginData.name], {}), // Prevent circular references
                writable: false,
                enumerable: false, // Important: `JSON.stringify(navigator.plugins)`
                configurable: true,
            });
        });
    }

    const patchNavigator = (name, value) =>
        _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.replaceProperty(Object.getPrototypeOf(navigator), name, {
            get() {
                return value;
            },
        });

    patchNavigator('mimeTypes', mimeTypes);
    patchNavigator('plugins', plugins);
}

try {
    mockPluginsAndMimeTypes({
        // We pass some functions to evaluate to structure the code more nicely
        fns: _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.stringifyFns({
            generateMimeTypeArray,
            generatePluginArray,
            generateMagicArray,
            generateFunctionMocks,
        }),
        _dataMMT,
    });
} catch (err) {
    console.log(err);
}

try {
    // Adds a contentWindow proxy to the provided iframe element
    const addContentWindowProxy = (iframe) => {
        const contentWindowProxy = {
            get(target, key) {
                if (key === 'self') return this;
                // iframe.contentWindow.frameElement === iframe // must be true
                if (key === 'frameElement') return iframe;
                return Reflect.get(target, key);
            },
        };

        if (!iframe.contentWindow) {
            const proxy = new Proxy(window, contentWindowProxy);
            Object.defineProperty(iframe, 'contentWindow', {
                get() {
                    return proxy;
                },
                set(newValue) {
                    return newValue; // contentWindow is immutable
                },
                enumerable: true,
                configurable: false,
            });
        }
    };

    // Handles iframe element creation, augments `srcdoc` property so we can intercept further
    const handleIframeCreation = (target, thisArg, args) => {
        const iframe = target.apply(thisArg, args);

        // We need to keep the originals around
        const _iframe = iframe;
        const _srcdoc = _iframe.srcdoc;

        // Add hook for the srcdoc property
        // We need to be very surgical here to not break other iframes by accident
        Object.defineProperty(iframe, 'srcdoc', {
            configurable: true, // Important, so we can reset this later
            get: function () {
                return _iframe.srcdoc;
            },
            set: function (newValue) {
                addContentWindowProxy(this);
                // Reset property, the hook is only needed once
                Object.defineProperty(iframe, 'srcdoc', {
                    configurable: false,
                    writable: false,
                    value: _srcdoc,
                });
                _iframe.srcdoc = newValue;
            },
        });
        return iframe;
    };

    // Adds a hook to intercept iframe creation events
    const addIframeCreationSniffer = () => {
        /* global document */
        const createElement = {
            // Make toString() native
            get(target, key) {
                return Reflect.get(target, key);
            },
            apply: function (target, thisArg, args) {
                const isIframe = args && args.length && `${args[0]}`.toLowerCase() === 'iframe';
                if (!isIframe) return target.apply(thisArg, args);
                else return handleIframeCreation(target, thisArg, args);
            },
        };
        // All this just due to iframes with srcdoc bug
        document.createElement = new Proxy(document.createElement, createElement);
    };

    // Let's go
    addIframeCreationSniffer();

    function createChromeObject() {
        if (!window.chrome) {
            // Use the exact property descriptor found in headful Chrome
            // fetch it via `Object.getOwnPropertyDescriptor(window, 'chrome')`
            Object.defineProperty(window, 'chrome', {
                writable: true,
                enumerable: true,
                configurable: false, // note!
                value: {}, // We'll extend that later
            });
        }
    }

    function chromeLoadTimes() {
        createChromeObject();

        if ('loadTimes' in window.chrome) return;

        if (!window.performance || !window.performance.timing || !window.PerformancePaintTiming) return;

        const { performance } = window;

        const ntEntryFallback = {
            nextHopProtocol: 'h2',
            type: 'other',
        };

        const protocolInfo = {
            get connectionInfo() {
                const ntEntry = performance.getEntriesByType('navigation')[0] || ntEntryFallback;
                return ntEntry.nextHopProtocol;
            },
            get npnNegotiatedProtocol() {
                const ntEntry = performance.getEntriesByType('navigation')[0] || ntEntryFallback;
                return ['h2', 'hq'].includes(ntEntry.nextHopProtocol) ? ntEntry.nextHopProtocol : 'unknown';
            },
            get navigationType() {
                const ntEntry = performance.getEntriesByType('navigation')[0] || ntEntryFallback;
                return ntEntry.type;
            },
            get wasAlternateProtocolAvailable() {
                return false;
            },
            get wasFetchedViaSpdy() {
                const ntEntry = performance.getEntriesByType('navigation')[0] || ntEntryFallback;
                return ['h2', 'hq'].includes(ntEntry.nextHopProtocol);
            },
            get wasNpnNegotiated() {
                const ntEntry = performance.getEntriesByType('navigation')[0] || ntEntryFallback;
                return ['h2', 'hq'].includes(ntEntry.nextHopProtocol);
            },
        };

        const { timing } = window.performance;

        function toFixed(num, fixed) {
            var re = new RegExp('^-?\\d+(?:.\\d{0,' + (fixed || -1) + '})?');
            return num.toString().match(re)[0];
        }

        const timingInfo = {
            get firstPaintAfterLoadTime() {
                return 0;
            },
            get requestTime() {
                return timing.navigationStart / 1000;
            },
            get startLoadTime() {
                return timing.navigationStart / 1000;
            },
            get commitLoadTime() {
                return timing.responseStart / 1000;
            },
            get finishDocumentLoadTime() {
                return timing.domContentLoadedEventEnd / 1000;
            },
            get finishLoadTime() {
                return timing.loadEventEnd / 1000;
            },
            get firstPaintTime() {
                const fpEntry = performance.getEntriesByType('paint')[0] || {
                    startTime: timing.loadEventEnd / 1000,
                };
                return toFixed((fpEntry.startTime + performance.timeOrigin) / 1000, 3);
            },
        };

        window.chrome.loadTimes = function () {
            return {
                ...protocolInfo,
                ...timingInfo,
            };
        };

        _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.patchToString(window.chrome.loadTimes);
    }

    function chromeCsi() {
        createChromeObject();

        if ('csi' in window.chrome) return;

        if (!window.performance || !window.performance.timing) return;

        const { timing } = window.performance;

        window.chrome.csi = function () {
            return {
                onloadT: timing.domContentLoadedEventEnd,
                startE: timing.navigationStart,
                pageT: Date.now() - timing.navigationStart,
                tran: 15, // Transition type or something
            };
        };

        _b3af9ee054d3337480ee6fbb3e9477502e74c63a_utils.patchToString(window.chrome.csi);
    }

    chromeLoadTimes();
    chromeCsi();
} catch (err) {
    // console.warn(err)
}

const windowFrame = 103;
window.outerHeight = window.innerHeight + windowFrame;

if (window.process) {
    delete window.process;
}

console.log('stealth evasions applied!');
