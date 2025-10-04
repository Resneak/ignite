import { considerDashTTLToBe } from './config';
import DebugTTLCacheNode from './debugTTLCacheNode';

const ttl = '124.768';
const staleIfError = '0.000';
const age = '55';
const serverIdentity = 'cache-sjc10056-SJC';
const debugTTLHit = `H ${serverIdentity} ${ttl} ${staleIfError} ${age}`;
const debugTTLHitWithParens = `(${debugTTLHit})`;
const debugTTLMiss = `M ${serverIdentity} - - 0`;
const debugTTLMissWithParens = `(${debugTTLMiss})`;

describe('parse debug ttl hit', () => {
    const node = new DebugTTLCacheNode(debugTTLHit);
    test('has expected properties', () => {
        expect(node.ttl).toBeCloseTo(parseFloat(ttl) * 1000);
        expect(node.staleIfError).toBe(staleIfError);
        expect(node.age).toBe(parseInt(age, 10));
        expect(node.didMiss).toBe(false);
        expect(node.serverIdentity).toBe(serverIdentity);
    });

    test('toString returns original debugTTL string with parens', () => {
        expect(node.toString()).toBe(debugTTLHitWithParens);
    });
});

describe('parse debug ttl hit with parenthesis', () => {
    const node = new DebugTTLCacheNode(debugTTLHitWithParens);
    test('has expected properties', () => {
        expect(node.ttl).toBeCloseTo(parseFloat(ttl) * 1000);
        expect(node.staleIfError).toBe(staleIfError);
        expect(node.age).toBe(parseInt(age, 10));
        expect(node.didMiss).toBe(false);
        expect(node.serverIdentity).toBe(serverIdentity);
    });

    test('toString returns original debugTTL string with parenthesis', () => {
        expect(node.toString()).toBe(debugTTLHitWithParens);
    });
});

describe('parse debug ttl miss', () => {
    const node = new DebugTTLCacheNode(debugTTLMiss);
    test('has expected properties', () => {
        expect(node.ttl).toBeCloseTo(considerDashTTLToBe * 1000);
        expect(node.staleIfError).toBe('-');
        expect(node.age).toBe(0);
        expect(node.didMiss).toBe(true);
        expect(node.serverIdentity).toBe(serverIdentity);
    });

    test('toString returns original debugTTL string with parenthesis', () => {
        expect(node.toString()).toBe(debugTTLMissWithParens);
    });
});

describe('parse debug ttl miss with parenthesis', () => {
    const node = new DebugTTLCacheNode(debugTTLMissWithParens);
    test('has expected properties', () => {
        expect(node.ttl).toBeCloseTo(considerDashTTLToBe * 1000);
        expect(node.staleIfError).toBe('-');
        expect(node.age).toBe(0);
        expect(node.didMiss).toBe(true);
        expect(node.serverIdentity).toBe(serverIdentity);
    });

    test('toString returns original debugTTL string with parenthesis', () => {
        expect(node.toString()).toBe(debugTTLMissWithParens);
    });
});
