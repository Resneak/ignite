import DebugPathCacheNode from './debugPathCacheNode';

const pop = 'lcy';
const nodeID = '1128';
const serverIdentity = `cache-${pop}${nodeID}-${pop.toUpperCase()}`;
const timestamp = Date.now();
const deliver = 'D';
const fetch = 'F';
const fetchDebugPath = `(${fetch} ${serverIdentity} ${timestamp})`;
const deliverDebugPathWithoutParens = `${deliver} ${serverIdentity} ${timestamp}`;

test('parses fetch debug path correctly with parens', () => {
    const cacheNode = new DebugPathCacheNode(fetchDebugPath);

    expect(cacheNode.nodeID).toBe(nodeID);
    expect(cacheNode.pop).toBe(pop);
    expect(cacheNode.serverIdentity).toBe(serverIdentity);
    expect(cacheNode.handledRequestAt).toBe(timestamp * 1000);
    expect(cacheNode.serverRole).toBe(fetch);
});

test('parses deliver debug path correctly without parens', () => {
    const cacheNode = new DebugPathCacheNode(deliverDebugPathWithoutParens);

    expect(cacheNode.nodeID).toBe(nodeID);
    expect(cacheNode.pop).toBe(pop);
    expect(cacheNode.serverIdentity).toBe(serverIdentity);
    expect(cacheNode.handledRequestAt).toBe(timestamp * 1000);
    expect(cacheNode.serverRole).toBe(deliver);
});

test('to string returns original format', () => {
    const cacheNode = new DebugPathCacheNode(deliverDebugPathWithoutParens);

    expect(cacheNode.toString()).toBe(deliverDebugPathWithoutParens);
});
