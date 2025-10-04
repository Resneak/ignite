import io, { Socket } from 'socket.io-client';
import Sizes from '../../../../lib/models/sizes';
import Env from '../../env';
import { FootsitesSocket, server } from '../../services/backend';
import DebugTTLs from '../../../../lib/models/fastly/debugTTLs';
import DebugPath from '../../../../lib/models/fastly/debugPath';

import { Promise as Bluebird } from 'bluebird';
import { randomNumber } from '../../../../lib/helpers';
import MaxListenersPerStatePromiseCollection from '../../../../lib/models/promises/maxListenerPromiseCollection';
import StatePromise from '../../../../lib/models/promises/statePromise';
import { CaptchaTask, GeeTestResponse } from '../../models/captchaSolvers/captchaSolver';
import { PromiseType } from '../../../../lib/models/promises/promiseCollection';

class CacheNodesPromise {
    private group: string;

    private promise!: Promise<CacheNode[]>;

    private resolve!: (cacheNodes: CacheNode[]) => void;

    state!: 'pending' | 'fulfilled';

    constructor(groupID: string) {
        this.group = groupID;
        this.resetPromise();
    }

    /**
     *
     * @returns returns a promise for the product
     */
    getCacheNodes() {
        return this.promise;
    }

    public resolvePromise(cacheNodes: CacheNode[]) {
        if (this.state === 'fulfilled') {
            return;
        }
        this.state = 'fulfilled';
        this.resolve(cacheNodes);
        this.resetPromise();
    }

    private resetPromise() {
        this.state = 'pending';
        this.promise = new Promise((res) => {
            this.resolve = res;
        });
    }
}

interface ProductGroup {
    store: string;
    pid: string;
    size: string;
}

export interface CacheNodeUpdate {
    headers: {
        xTimer: string;
        debugTTL: string;
        debugPaths: string;
    };
    productGroup: ProductGroup;
    /**
     * ttl that we attempted to hit
     */
    ttl?: number;
    didATC?: boolean;
}

export interface CacheNode {
    name: string; //'fjr792'
    ttl: number; // Date.now() + time to live
    productGroup: ProductGroup;
}

export interface FootsitesProductGroups {
    store: string;
    pid: string;
    sizes: Sizes;
}

export default class FootsitesManager {
    /**
     * set of all product groups being run by all footsites tasks (represented as strings to avoid duplicates)
     */
    private productGroups: Set<string>;

    /**
     * map of product group ids to a promise for a cache node for a site/pid/size combo
     */
    private cacheNodePromises: Map<string, CacheNodesPromise>;

    private socket: Socket;

    private isRunning: boolean = false;

    private updateBatch: { sendAt: number; updates: Map<string, CacheNodeUpdate>; timeout?: NodeJS.Timeout };

    private sharedCaptchaTokens: MaxListenersPerStatePromiseCollection<
        StatePromise<{ action: 'wait' | 'solve'; promise: Promise<string | GeeTestResponse> }>
    >;

    private static instance: FootsitesManager;
    public static getInstance(productGroups: FootsitesProductGroups) {
        if (!this.instance) {
            this.instance = new FootsitesManager();
        }

        const addToProductGroups = (group: ProductGroup) => {
            this.instance.productGroups.add(JSON.stringify(group));
        };
        this.instance.forEachGroup(productGroups, addToProductGroups);

        return this.instance;
    }

    /**
     * called once tasks start to join group for each site/pid/size combo
     */
    public onStart() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.socket.connect();
        }
    }

    private sendProductGroups() {
        const groups: object[] = [];
        this.productGroups.forEach((item) => groups.push(JSON.parse(item)));
        this.socket.emit(FootsitesSocket.events.clientRequestJoinProductGroups, groups);
    }

    public getSharedToken(captchaTask: CaptchaTask) {
        let id = `${captchaTask.type}-${captchaTask.siteKey}`;

        let statePromise = this.sharedCaptchaTokens.getPromise(id);
        let action = statePromise.promisesMade === 0 ? 'solve' : 'wait';

        let resolve = action === 'solve' ? statePromise.resolve.bind(statePromise) : undefined;
        return { promise: statePromise.promise, action, resolve };
    }

    /**
     *
     * @param productGroups that the task would like to recieve a cache node for
     * @returns a promise to resolve with a cache node for one of the specific product groups
     */
    public getNextCacheNode(productGroups: FootsitesProductGroups): Promise<CacheNode> {
        return new Promise<CacheNode>(async (resolve) => {
            const productPromises: Promise<CacheNode[]>[] = [];
            const cacheNodesPromises: CacheNodesPromise[] = [];

            const addProductGroupPromiseToProductPromises = (productGroup: ProductGroup) => {
                const id = this.getProductGroupID(productGroup);

                if (!this.cacheNodePromises.has(id)) {
                    this.createProductGroupPromise(id);
                }

                const cacheNodeGroupPromise = this.cacheNodePromises.get(id);

                if (cacheNodeGroupPromise) {
                    cacheNodesPromises.push(cacheNodeGroupPromise);
                    productPromises.push(cacheNodeGroupPromise.getCacheNodes());
                }
            };
            this.forEachGroup(productGroups, addProductGroupPromiseToProductPromises);

            let minTTL = Infinity;
            let timeout;
            let resolved: CacheNode[] = [];
            let done = false;

            const PromiseAllUntil = (all: CacheNodesPromise[]) => {
                Bluebird.any(all.map((item) => item.getCacheNodes())).then((cacheNodes) => {
                    if (done) return;
                    // console.log(`Product group resolved`);
                    // console.dir(cacheNodes);
                    resolved = [...resolved, ...cacheNodes];
                    if (cacheNodes?.[0]?.ttl < minTTL) {
                        minTTL = cacheNodes?.[0]?.ttl;
                        let difference = Date.now() - minTTL;
                        let sendToTaskIn = difference - 4000 > 0 ? difference - 4000 : 0;
                        clearTimeout(timeout);
                        // console.log(`Resolving in ${Math.floor(minTTL / 1000)}`);
                        timeout = setTimeout(() => {
                            const randomCacheNode = resolved[randomNumber(0, resolved.length - 1)];
                            done = true;
                            resolve(randomCacheNode);
                            return;
                        }, sendToTaskIn);
                    }

                    const pending = all.filter((item) => item.state === 'pending');
                    PromiseAllUntil(pending);
                });
            };

            PromiseAllUntil(cacheNodesPromises);
        });
    }

    /**
     *
     * @param cacheNode to be sent to the server
     */
    public updateCacheNode(update: CacheNodeUpdate) {
        const debugPath = new DebugPath(update.headers.debugPaths);
        const debugTTLs = new DebugTTLs(update.headers.debugTTL);
        if (!debugTTLs.edge.name) return;
        // Env.isDev && console.log(debugTTLs.edge.name);

        const TTLtimestamp = debugTTLs.edge.ttl + debugPath.edge.deliver.handledRequestAt;
        const expectedTTL = update.ttl || 0;
        this.logTTL(expectedTTL, TTLtimestamp);

        let spammedCacheNode = false;
        const debugTTLsArray = [debugTTLs.edge, debugTTLs.shield];

        if (!this.socket.connected) {
            for (const debugTTL of debugTTLsArray) {
                if (!debugTTL) {
                    continue;
                } else if (debugTTL.ttl < 2500) {
                    Env.isDev && console.log(`resolving ${debugTTL.name}`);
                    this.resolveProductGroupPromise([
                        {
                            name: debugTTL.name,
                            ttl: TTLtimestamp,
                            productGroup: update.productGroup,
                        },
                    ]);
                    spammedCacheNode = true;
                }
            }
        }

        //TODO what do we do with cache nodes with a ttl between 2.5 seconds and 13 seconds?
        //TODO should we really spam with all cache nodes on TTL < 2.5 seconds?

        // server sends collections of cache nodes to client with a max ttl of 11s
        let sendBy = TTLtimestamp - 13000;
        if (spammedCacheNode || sendBy < Date.now()) {
            return;
        }

        const serverGroupID = this.getServerGroupID(debugTTLs.edge.name, update.productGroup);

        if (!this.updateBatch.updates.has(serverGroupID)) {
            this.updateBatch.updates.set(serverGroupID, update);
            if (sendBy < this.updateBatch.sendAt) {
                this.updateBatch.sendAt = sendBy;
                if (this.updateBatch.timeout) clearTimeout(this.updateBatch.timeout);
                this.updateBatch.timeout = setTimeout(() => {
                    const updates: CacheNodeUpdate[] = [...this.updateBatch.updates.values()];
                    Env.isDev && console.log('sending updates');
                    this.socket.emit(FootsitesSocket.events.clientSendCacheNodeUpdates, updates);
                    this.updateBatch.updates = new Map();
                    this.updateBatch.sendAt = Infinity;
                }, sendBy - Date.now());
            }
        }
    }

    private constructor() {
        this.productGroups = new Set();
        this.cacheNodePromises = new Map();
        this.socket = io(`${server()}${FootsitesSocket.namespace}`, {
            auth: {
                name: Env?.user?.name,
                token: Env?.user?.key,
            },
            autoConnect: false,
        });
        this.registerSocketIOHandlers();
        this.updateBatch = { sendAt: Infinity, updates: new Map() };

        this.sharedCaptchaTokens = new MaxListenersPerStatePromiseCollection({
            type: PromiseType.StatePromise,
            maxNumberOfPromisesPerPromise: 5,
        });
    }

    /**
     *
     * @param productGroups
     * @param fn to be called with each productGroup
     */
    private forEachGroup({ store, pid, sizes }: FootsitesProductGroups, fn: ({ store, pid, size }: ProductGroup) => void) {
        const userSelectedSizes = sizes.isRandom() ? sizes.siteSupportedSizes.filter((size) => size !== 'random') : sizes.userSelectedSizes;
        for (const size of userSelectedSizes) {
            const group = { store, pid, size };
            fn(group);
        }
    }

    private getProductGroupID(productGroup: ProductGroup) {
        return `${productGroup.store}-${productGroup.pid}-${productGroup.size}`;
    }

    private getServerGroupID(serverIdentity: string, productGroup: ProductGroup) {
        return `${serverIdentity}-${this.getProductGroupID(productGroup)}`;
    }

    /**
     *
     * @param id for the site/pid/size combination
     */
    private createProductGroupPromise(productGroupID: string) {
        const cacheNodePromise = new CacheNodesPromise(productGroupID);
        this.cacheNodePromises.set(productGroupID, cacheNodePromise);
    }

    /**
     *
     * @param nodes that should be distributed to tasks
     */
    private resolveProductGroupPromise(nodes: CacheNode[]) {
        const id = this.getProductGroupID(nodes?.[0]?.productGroup);
        const cacheNodePromise = this.cacheNodePromises.get(id);
        if (cacheNodePromise) {
            cacheNodePromise.resolvePromise(nodes);
        }
    }

    private registerSocketIOHandlers() {
        this.socket.on('connect', () => {
            this.sendProductGroups();
        });
        /**
         * dispatches ttls by resolving promises for the products received
         */
        this.socket.on(FootsitesSocket.events.serverSendUpcomingTTLs, (nodes: CacheNode[]) => {
            this.resolveProductGroupPromise(nodes);
        });
    }

    private logTTL(expectedTTL: number, timestamp: number) {
        if (Env.isDev && expectedTTL !== 0) {
            const diff = timestamp - expectedTTL;
            const diffMsg = diff < 0 ? `Early by ${Math.abs(diff / 1000)}s` : `Late by ${diff / 1000}s`;
            // console.table([{ expectedTTL, timestamp, diff: diffMsg }]);
        }
    }
}
