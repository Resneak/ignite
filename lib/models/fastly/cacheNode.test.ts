import CacheNode from './cacheNode';

const pop = 'lcy';
const nodeID = '1128';
const serverIdentity = `cache-${pop}${nodeID}-${pop.toUpperCase()}`;
test('parses server identity correctly', () => {
    const cacheNode = new CacheNode(serverIdentity);

    expect(cacheNode.nodeID).toBe(nodeID);
    expect(cacheNode.pop).toBe(pop);
    expect(cacheNode.serverIdentity).toBe(serverIdentity);
});

test('parses id correctly', () => {
    const cacheNode = new CacheNode(`${pop}${nodeID}`);

    expect(cacheNode.nodeID).toBe(nodeID);
    expect(cacheNode.pop).toBe(pop);
    expect(cacheNode.serverIdentity).toBe(serverIdentity);
});

test('to string returns server identity', () => {
    const cacheNode = new CacheNode(serverIdentity);

    expect(cacheNode.toString()).toBe(serverIdentity);
});
