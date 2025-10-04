// Regex

/**
 * group 1: ip, group 2: port
 */
export const proxyRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b:(\d{2,5})/;

export const newlineRegex = /\r?\n/;

/**
 * group 1: username, group 2: password
 */
export const loginCredentialsRegex = /^(.*?):(.*)$/;

/**
 * group 1: filename group 2: file extension
 */
export const cvvRegex = /^(\d{3,4})$/;

export const creditCardRegex = /^(\d{8,19})$/;

export const emailRegex = /^\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b$/;

// email@gmail.com:password
export const emailPasswordRegex = /^\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b:.+$/;

export const phoneRegex = /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

export const zipRegex = /^(\d{5})(-\d{4})?$/;
