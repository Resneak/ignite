import DebugPath from './debugPath';
import DebugPathCacheNode from './debugPathCacheNode';

const edgeDeliver = new DebugPathCacheNode('(D cache-lcy1128-LCY 1415969775)');
const edgeFetch = new DebugPathCacheNode('(F cache-lcy1130-LCY 1415969775)');
const shieldDeliver = new DebugPathCacheNode('(D cache-sjc3132-SJC 1415969775)');
const shieldFetch = new DebugPathCacheNode('(F cache-sjc3128-SJC 1415969775)');

const fullPath =
    '(D cache-lcy1128-LCY 1415969775) (F cache-lcy1130-LCY 1415969775) (D cache-sjc3132-SJC 1415969775) (F cache-sjc3128-SJC 1415969775)';
const shieldingDisabled = '(D cache-lcy1128-LCY 1415969775) (F cache-lcy1130-LCY 1415969775)';
const clusteringDisabled = '(D cache-lcy1128-LCY 1415969775) (D cache-sjc3132-SJC 1415969775)';
const shieldingAndClusteringDisabled = '(D cache-lcy1128-LCY 1415969775)';

describe('shielding and clustering enabled', () => {
    const debugPaths = new DebugPath(fullPath);

    test('parses full path', () => {
        expect(debugPaths.edge.deliver).toEqual(edgeDeliver);
        expect(debugPaths.shield?.deliver).toEqual(shieldDeliver);
        expect(debugPaths.edge.fetch).toEqual(edgeFetch);
        expect(debugPaths.shield?.fetch).toEqual(shieldFetch);
    });

    test('shielding enabled, clusering enabled', () => {
        expect(debugPaths.isClusteringEnabled).toBe(true);
        expect(debugPaths.isShieldingEnabled).toBe(true);
    });

    test('to string returns original debug path header', () => {
        expect(debugPaths.toString()).toBe(fullPath);
    });
});

describe('shielding disabled', () => {
    const debugPaths = new DebugPath(shieldingDisabled);

    test('parses path with shielding disabled', () => {
        expect(debugPaths.edge.deliver).toEqual(edgeDeliver);
        expect(debugPaths.shield?.deliver).toBeUndefined();
        expect(debugPaths.edge.fetch).toEqual(edgeFetch);
        expect(debugPaths.shield?.fetch).toBeUndefined();
    });

    test('shielding disabled, clusering enabled', () => {
        expect(debugPaths.isClusteringEnabled).toBe(true);
        expect(debugPaths.isShieldingEnabled).toBe(false);
    });

    test('to string returns original debug path header', () => {
        expect(debugPaths.toString()).toBe(shieldingDisabled);
    });
});

describe('clustering disabled', () => {
    const debugPaths = new DebugPath(clusteringDisabled);

    test('parses path with clustering disabled', () => {
        expect(debugPaths.edge.deliver).toEqual(edgeDeliver);
        expect(debugPaths.shield?.deliver).toEqual(shieldDeliver);
        expect(debugPaths.edge.fetch).toBeUndefined();
        expect(debugPaths.shield?.fetch).toBeUndefined();
    });

    test('shielding enabled, clusering disabled', () => {
        expect(debugPaths.isClusteringEnabled).toBe(false);
        expect(debugPaths.isShieldingEnabled).toBe(true);
    });

    test('to string returns original debug path header', () => {
        expect(debugPaths.toString()).toBe(clusteringDisabled);
    });
});

describe('shielding and clustering disabled', () => {
    const debugPaths = new DebugPath(shieldingAndClusteringDisabled);
    test('parses path with shielding and clustering disabled', () => {
        expect(debugPaths.edge.deliver).toEqual(edgeDeliver);
        expect(debugPaths.shield?.deliver).toBeUndefined();
        expect(debugPaths.edge.fetch).toBeUndefined();
        expect(debugPaths.shield?.fetch).toBeUndefined();
    });

    test('clustering and shielding are disabled', () => {
        expect(debugPaths.isClusteringEnabled).toBe(false);
        expect(debugPaths.isShieldingEnabled).toBe(false);
    });

    test('to string returns original debug path header', () => {
        expect(debugPaths.toString()).toBe(shieldingAndClusteringDisabled);
    });
});
