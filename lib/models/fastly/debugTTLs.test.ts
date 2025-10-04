import exp from 'constants';
import DebugTTLCacheNode from './debugTTLCacheNode';
import DebugTTLs from './debugTTLs';

const edgeIdentity = 'cache-sjc10056-SJC';
const shieldIdentity = 'cache-sjc10054-SJC';
const edgeHit = '(H ${edgeIdentity} 124.768 0.000 55)';
const shieldHit = '(H ${shieldIdentity} 124.768 0.000 55)';

const debugTTLsHit = `${edgeHit} ${shieldHit}`;
const debugTTLsHitWithoutShielding = `${edgeHit}`;
const edgeMiss = `(M ${edgeIdentity} - - 0)`;
const shieldMiss = `(M ${shieldIdentity} - - 0)`;

const debugTTLsMiss = `${edgeMiss} ${shieldMiss}`;
const debugTTLsMissWithoutShielding = `${edgeMiss}`;

describe('parses debug ttl hit with shielding', () => {
    const debugTTLs = new DebugTTLs(debugTTLsHit);
    test('correct edge and shield cache nodes', () => {
        expect(debugTTLs.edge).toEqual(new DebugTTLCacheNode(edgeHit));
        expect(debugTTLs.shield).toEqual(new DebugTTLCacheNode(shieldHit));
    });
});

describe('parses debug ttl hit without shielding', () => {
    const debugTTLs = new DebugTTLs(debugTTLsHitWithoutShielding);
    test('correct edge and shield cache nodes', () => {
        expect(debugTTLs.edge).toEqual(new DebugTTLCacheNode(edgeHit));
        expect(debugTTLs.shield).toBeUndefined();
    });
});

describe('parses debug ttl miss with shielding', () => {
    const debugTTLs = new DebugTTLs(debugTTLsMiss);
    test('correct edge and shield cache nodes', () => {
        expect(debugTTLs.edge).toEqual(new DebugTTLCacheNode(edgeMiss));
        expect(debugTTLs.shield).toEqual(new DebugTTLCacheNode(shieldMiss));
    });
});

describe('parses debug ttl miss without shielding', () => {
    const debugTTLs = new DebugTTLs(debugTTLsMissWithoutShielding);
    test('correct edge and shield cache nodes', () => {
        expect(debugTTLs.edge).toEqual(new DebugTTLCacheNode(edgeMiss));
        expect(debugTTLs.shield).toBeUndefined();
    });
});
