import type { ResolverFn } from '../resolve';
import type { ParserFn } from '../utils';
import { execa } from '../utils';

const SHELL_COMMAND = 'ioreg -rd1 -c IOPlatformExpertDevice';
const parse: ParserFn = (raw) =>
    raw
        .split('IOPlatformUUID')[1]
        .split('\n')[0]
        .replace(/=|\s+|"/gi, '')
        .toLowerCase();

export const darwinHWID: ResolverFn = async () => execa(SHELL_COMMAND, parse);
