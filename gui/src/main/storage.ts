import { appendFile } from 'fs';
import { promisify } from 'util';

const appendFileAsync = promisify(appendFile);

/**
 * class for everything related to file storage
 */
export default class Storage {
    /**
     * append specified content to the end of a file
     *
     * if the file doesn't exist yet, it will be created
     */
    static appendToFile(filePath: string, contents: string | Uint8Array): Promise<void | Error> {
        return appendFileAsync(filePath, contents);
    }
}
