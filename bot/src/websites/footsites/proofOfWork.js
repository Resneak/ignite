// https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
// Only the encoding part
(function(window) {
	var fromCharCode = String.fromCharCode;
	var originalBtoa = btoa;

	function btoaReplacer(nonAsciiChars) {
		// make the UTF string into a binary UTF-8 encoded string
		var point = nonAsciiChars.charCodeAt(0);
		if (point >= 0xD800 && point <= 0xDBFF) {
			var nextcode = nonAsciiChars.charCodeAt(1);
			if (nextcode !== nextcode) // NaN because string is 1 code point long
			return fromCharCode(0xef /*11101111*/ , 0xbf /*10111111*/ , 0xbd /*10111101*/ );
			// https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
			if (nextcode >= 0xDC00 && nextcode <= 0xDFFF) {
				point = (point - 0xD800) * 0x400 + nextcode - 0xDC00 + 0x10000;
				if (point > 0xffff) return fromCharCode(
				(0x1e /*0b11110*/ << 3) | (point >>> 18), (0x2 /*0b10*/ << 6) | ((point >>> 12) & 0x3f /*0b00111111*/ ), (0x2 /*0b10*/ << 6) | ((point >>> 6) & 0x3f /*0b00111111*/ ), (0x2 /*0b10*/ << 6) | (point & 0x3f /*0b00111111*/ ));
			} else return fromCharCode(0xef, 0xbf, 0xbd);
		}
		if (point <= 0x007f) return inputString;
		else if (point <= 0x07ff) {
			return fromCharCode((0x6 << 5) | (point >>> 6), (0x2 << 6) | (point & 0x3f));
		} else return fromCharCode(
		(0xe /*0b1110*/ << 4) | (point >>> 12), (0x2 /*0b10*/ << 6) | ((point >>> 6) & 0x3f /*0b00111111*/ ), (0x2 /*0b10*/ << 6) | (point & 0x3f /*0b00111111*/ ));
	}
	window.queueitProofOfWorkBase64 = function(inputString, BOMit) {
		return originalBtoa((BOMit ? "\xEF\xBB\xBF" : "") + inputString.replace(
			/[\x80-\uD7ff\uDC00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]?/g, btoaReplacer));
	};
})(typeof global === "" + void 0 ? typeof self === "" + void 0 ? this : self : global);

captcha_run: {
	// Get function name of callback from script tag
	var scriptElement = document.querySelector('script[data-name="queueitProofOfWork"]');
	var callbackName = scriptElement.getAttribute("data-onload");

	if (!callbackName) {
		console.log("Please specify a callback to be called when the proof of work script has been loaded");
		break captcha_run;
	}

	if (!window[callbackName]) {
		console.log("The provided callback is not accessible. Please make sure it's in the global scope.");
		break captcha_run;
	}

	var queueitProofOfWork = (function() {
		function getClientInfo() {
			try {

				var unknown = 'Unknown';

				// screen
				var screenSize = '';
				if (screen.width) {
					var width = screen.width ? screen.width : '';
					var height = screen.height ? screen.height : '';
					screenSize += '' + width + " x " + height;
				}

				//browser
				var nVer = navigator.appVersion;
				var nAgt = navigator.userAgent;
				var browser = navigator.appName;
				var version = '' + parseFloat(navigator.appVersion);
				var majorVersion = parseInt(navigator.appVersion, 10);
				var nameOffset, verOffset, ix;

				// Opera
				if ((verOffset = nAgt.indexOf('Opera')) !== -1) {
					browser = 'Opera';
					version = nAgt.substring(verOffset + 6);
					if ((verOffset = nAgt.indexOf('Version')) !== -1) {
						version = nAgt.substring(verOffset + 8);
					}
				}
				// MSIE
				else if ((verOffset = nAgt.indexOf('MSIE')) !== -1) {
					browser = 'Microsoft Internet Explorer';
					version = nAgt.substring(verOffset + 5);
				}
				//IE 11 no longer identifies itself as MS IE, so trap it
				//http://stackoverflow.com/questions/17907445/how-to-detect-ie11
				else if (browser === 'Netscape' && nAgt.indexOf('Trident/') !== -1) {

					browser = 'Microsoft Internet Explorer';
					version = nAgt.substring(verOffset + 5);
					if ((verOffset = nAgt.indexOf('rv:')) !== -1) {
						version = nAgt.substring(verOffset + 3);
					}

				}
				// Chrome
				else if ((verOffset = nAgt.indexOf('Chrome')) !== -1) {
					browser = 'Chrome';
					version = nAgt.substring(verOffset + 7);
				}
				// Safari
				else if ((verOffset = nAgt.indexOf('Safari')) !== -1) {
					browser = 'Safari';
					version = nAgt.substring(verOffset + 7);
					if ((verOffset = nAgt.indexOf('Version')) !== -1) {
						version = nAgt.substring(verOffset + 8);
					}

					// Chrome on iPad identifies itself as Safari. Actual results do not match what Google claims
					//  at: https://developers.google.com/chrome/mobile/docs/user-agent?hl=ja
					//  No mention of chrome in the user agent string. However it does mention CriOS, which presumably
					//  can be keyed on to detect it.
					if (nAgt.indexOf('CriOS') !== -1) {
						//Chrome on iPad spoofing Safari...correct it.
						browser = 'Chrome';
						//Don't believe there is a way to grab the accurate version number, so leaving that for now.
					}
				}
				// Firefox
				else if ((verOffset = nAgt.indexOf('Firefox')) !== -1) {
					browser = 'Firefox';
					version = nAgt.substring(verOffset + 8);
				}
				// Other browsers
				else if ((nameOffset = nAgt.lastIndexOf(' ') + 1) < (verOffset = nAgt.lastIndexOf('/'))) {
					browser = nAgt.substring(nameOffset, verOffset);
					version = nAgt.substring(verOffset + 1);
					if (browser.toLowerCase() === browser.toUpperCase()) {
						browser = navigator.appName;
					}
				}
				// trim the version string
				if ((ix = version.indexOf(';')) !== -1) version = version.substring(0, ix);
				if ((ix = version.indexOf(' ')) !== -1) version = version.substring(0, ix);
				if ((ix = version.indexOf(')')) !== -1) version = version.substring(0, ix);

				majorVersion = parseInt('' + version, 10);
				if (isNaN(majorVersion)) {
					version = '' + parseFloat(navigator.appVersion);
					majorVersion = parseInt(navigator.appVersion, 10);
				}

				// mobile version
				var mobile = /Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(nVer);

				// cookie
				var cookieEnabled = navigator.cookieEnabled ? true : false;

				if (typeof navigator.cookieEnabled === 'undefined' && !cookieEnabled) {
					document.cookie = 'testcookie';
					cookieEnabled = document.cookie.indexOf('testcookie') !== -1 ? true : false;
				}

				// system
				var os = unknown;
				var clientStrings = [{
					s: 'Windows 3.11',
					r: /Win16/
				}, {
					s: 'Windows 95',
					r: /(Windows 95|Win95|Windows_95)/
				}, {
					s: 'Windows ME',
					r: /(Win 9x 4.90|Windows ME)/
				}, {
					s: 'Windows 98',
					r: /(Windows 98|Win98)/
				}, {
					s: 'Windows CE',
					r: /Windows CE/
				}, {
					s: 'Windows 2000',
					r: /(Windows NT 5.0|Windows 2000)/
				}, {
					s: 'Windows XP',
					r: /(Windows NT 5.1|Windows XP)/
				}, {
					s: 'Windows Server 2003',
					r: /Windows NT 5.2/
				}, {
					s: 'Windows Vista',
					r: /Windows NT 6.0/
				}, {
					s: 'Windows 7',
					r: /(Windows 7|Windows NT 6.1)/
				}, {
					s: 'Windows 8.1',
					r: /(Windows 8.1|Windows NT 6.3)/
				}, {
					s: 'Windows 8',
					r: /(Windows 8|Windows NT 6.2)/
				}, {
					s: 'Windows 10',
					r: /(Windows NT 10.0)/
				}, {
					s: 'Windows NT 4.0',
					r: /(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/
				}, {
					s: 'Windows ME',
					r: /Windows ME/
				}, {
					s: 'Android',
					r: /Android/
				}, {
					s: 'Open BSD',
					r: /OpenBSD/
				}, {
					s: 'Sun OS',
					r: /SunOS/
				}, {
					s: 'Linux',
					r: /(Linux|X11)/
				}, {
					s: 'iOS',
					r: /(iPhone|iPad|iPod)/
				}, {
					s: 'Mac OS X',
					r: /Mac OS X/
				}, {
					s: 'Mac OS',
					r: /(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/
				}, {
					s: 'QNX',
					r: /QNX/
				}, {
					s: 'UNIX',
					r: /UNIX/
				}, {
					s: 'BeOS',
					r: /BeOS/
				}, {
					s: 'OS/2',
					r: /OS\/2/
				}, {
					s: 'Search Bot',
					r: /(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/
				}];
				for (var id in clientStrings) {
					var cs = clientStrings[id];
					if (cs.r.test(nAgt)) {
						os = cs.s;
						break;
					}
				}

				var osVersion = unknown;

				if (/Windows/.test(os)) {
					osVersion = /Windows (.*)/.exec(os)[1];
					os = 'Windows';
				}

				switch (os) {
					case 'Mac OS X':
						osVersion = /Mac OS X (10[\.\_\d]+)/.exec(nAgt)[1];
						break;

					case 'Android':
						osVersion = /Android ([\.\_\d]+)/.exec(nAgt)[1];
						break;

					case 'iOS':
						osVersion = /OS (\d+)_(\d+)_?(\d+)?/.exec(nVer);
						osVersion = osVersion[1] + '.' + osVersion[2] + '.' + (osVersion[3] | 0);
						break;

				}

				return {
					screen: screenSize,
					browser: browser,
					browserVersion: version,
					mobile: mobile,
					os: os,
					osVersion: osVersion,
					cookies: cookieEnabled
				};
			} catch (e) {
				return {
					screen: "",
					browser: "",
					browserVersion: "",
					mobile: false,
					os: "",
					osVersion: "",
					cookies: false
				};
			}
		}

		function isObject(item) {
			// !! (double bang) forces a truthy value
			return !!item && item === Object(item);
		}

		var _scriptElement = scriptElement;
		var _scriptSrc = _scriptElement.getAttribute("src");
		var _isServiceApi;
		var _baseUrl;
		if (_scriptSrc.indexOf("/serviceapi") !== -1) {
			_baseUrl = _scriptSrc.split("/serviceapi")[0]
			_isServiceApi = true;
		} else if (_scriptSrc.indexOf("/challengeapi") !== -1) {
			_baseUrl = _scriptSrc.split("/challengeapi")[0]
			_isServiceApi = true;
		} else {
			_baseUrl = _scriptSrc.split("/js")[0]
			_isServiceApi = false;
		}

		var _callback;
		var _errorHandler;
		var _headerTags = {};
		var _clientInfo = getClientInfo();
		var _session = {
			userId: "",
			meta: {},
			sessionId: "",
			solution: "",
			tags: [],
			stats: {
				duration: 0,
				tries: 0,
				userAgent: navigator.userAgent,
				screen: _clientInfo.screen,
				browser: _clientInfo.browser,
				browserVersion: _clientInfo.browserVersion,
				isMobile: _clientInfo.mobile,
				os: _clientInfo.os,
				osVersion: _clientInfo.osVersion,
				cookiesEnabled: _clientInfo.cookies
			}
		};

		var _beforeChallenge, _doChallenge;

		function init(parameters) {
			_callback = parameters.callback;
			_errorHandler = parameters.errorHandler;
			_session.userId = parameters.userId;
			_session.stats.tries++;
			_session.tags.length = 0;
			_headerTags = {};
			if (parameters.tags && isObject(parameters.tags)) {
				for (var property in parameters.tags) {
					// Need to check each value if it's an array or object. If so, then ignore
					var tagValue = parameters.tags[property];
					if (isObject(tagValue) || Array.isArray(tagValue)) {
						continue;
					}
					var tagName = "powTag-" + property;
					_headerTags[tagName] = tagValue;
					_session.tags.push(tagName + ":" + tagValue);
				}
			}
		}

		function resolve() {
			_session.stats.duration = (new Date()).getTime() - _beforeChallenge;
			var resolvedParsed = JSON.stringify(_session);
			var encoded = queueitProofOfWorkBase64(resolvedParsed, false);
			_callback(encoded);
		}

		function loadChallenge() {
			function registerChallenge(data) {
				_session.meta = data.meta;
				_session.sessionId = data.sessionId;
				_session.parameters = data.parameters;

				_doChallenge = new Function("return " + data.function)();
			}

			function getChallenge(url) {

				var request = new XMLHttpRequest();
				request.open('POST', url, true);
				request.withCredentials = false;

				for (var header in _headerTags) {
					request.setRequestHeader(header, _headerTags[header]);
				}

				request.onload = function() {
					if (this.status === 200) {
						var response = JSON.parse(this.responseText);
						registerChallenge(response);
						_beforeChallenge = (new Date()).getTime();
						_doChallenge(_session, resolve);
					} else {
						_errorHandler("Could not fetch challenge. Server returned '" + this.statusText + "'");
					}
				};

				request.addEventListener("error", function(e) {
					_errorHandler("Failed to execute ajax request. Error: '" + JSON.stringify({
						lengthComputable: e.lengthComputable,
						isProgressEvent: e instanceof ProgressEvent,
						loaded: e.loaded,
						total: e.total,
						currentTarget: e.currentTarget,
						eventPhase: e.eventPhase,
						target: e.target,
						timeStamp: e.timeStamp,
						type: e.type,
						isTrusted: e.isTrusted
					}) + "'");
				});

				request.send();
			}

			var path = _isServiceApi ? "/challengeapi/pow/challenge/" : "/api/challenge/";
			var url = _baseUrl + path + _session.userId;
			if (_session.sessionId !== "") {
				url = url + "/" + _session.sessionId;
			}

			getChallenge(url);
		}

		var self = {
			execute: function(parameters) {
				// add site key later
				if (!parameters || !parameters.callback || !parameters.errorHandler || !parameters.userId) {
					throw Error("Missing required parameter property");
				}

				parameters.tags.UserId = parameters.userId;
				init(parameters);

				// after introducing site key, split up flow, so key is checked, before challenge is downloaded
				// flow: loadChallenge --> _doChallenge --> _callback                
				loadChallenge();
			},
			canRetry: function() {
				return _session.stats.tries < 10;
			},
			retry: function() {
				if (!_callback || !_errorHandler) {
					throw Error("Execute has not been called");
				}

				_session.stats.tries++;
				loadChallenge();
			}
		};

		return self;
	})();

	window[callbackName]();
}