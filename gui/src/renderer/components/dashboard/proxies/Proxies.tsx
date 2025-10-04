import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import ProxiesModal from './modal/ProxiesModal';
import Button from '../../shared/Button';
import Search from '../../shared/Search';

import Icon, { Icons } from '../../shared/Icons/Icon';
import Next from '../../../../../assets/svg/next.svg';

import './Proxies.scss';

import ProxyList from '../../../../lib/models/proxyList';
import ProxyWrapper from './ProxyWrapper';
import Table from '../../shared/Table';
import ProxiesItem from './ProxiesItem';

import { testProxy, testWebsites } from '../../../services/tester';

interface Props {
    proxyLists: ProxyList[];
    addProxyList: (proxyList: ProxyList) => void;
    deleteAllProxies: () => void;
    deleteProxy: (id: string) => void;
    updateProxyList: (proxyList: ProxyList) => void;
}

const Proxies = ({ proxyLists, addProxyList, deleteProxy, deleteAllProxies, updateProxyList }: Props) => {
    const [showModal, setShowModal] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    // proxyList contains all proxy wrapper objects. These are in sync with redux store
    const [proxyList, setProxyList] = useState<ProxyWrapper[]>([]);

    // displayProxyList is a subset of proxyList and only contains proxy wrappers currently displayed these are updated when the user searches
    const [displayProxyList, setDisplayProxyList] = useState<ProxyWrapper[]>(proxyList);

    const [activeCount, setActiveCount] = useState(0);
    const [countDisplay, setCountDisplay] = useState('All');

    const [testWebsite, setTestWebsite] = useState('Walmart');

    // convert ProxyList[] from props to ProxyWrappers[]
    useEffect(() => {
        setProxyList(proxylistsToWrapper(proxyLists));
    }, [proxyLists]);

    // update displayed proxies and count when proxyList changes

    useEffect(() => {
        let count = 0;
        proxyList.forEach((proxyWrapper) => {
            count += proxyWrapper.active ? 1 : 0;
        });
        setActiveCount(count);
        setDisplayProxyList(proxyList);
    }, [proxyList]);

    useEffect(() => {
        setCountDisplay(activeCount === 0 ? 'All' : `(${activeCount})`);
    }, [activeCount]);

    /**
     * converts array of ProxyList to an array of ProxyWrappers
     * @param lists to convert
     */
    const proxylistsToWrapper = (lists: ProxyList[]) => {
        const res: ProxyWrapper[] = [];
        lists?.forEach((list) => {
            list.proxies.forEach((p) => {
                res.push({
                    listID: list.id,
                    listName: list.name,
                    proxy: p,
                    active: false,
                });
            });
        });
        return res;
    };

    /**
     *
     * @param id of ProxyWrapper to toggle
     */
    const toggleProxy = (id: string) => {
        const updatedList: ProxyWrapper[] = [];
        proxyList.forEach((item: ProxyWrapper) => {
            if (item.proxy.id === id) {
                const temp = item;
                temp.active = !item.active;
                updatedList.push(temp);
            } else {
                updatedList.push(item);
            }
        });
        setProxyList(updatedList);
    };

    const searchProxies = (query: string) => {
        setDisplayProxyList(
            proxyList?.filter((item) => {
                const properties = `${item.listName} ${item.proxy.ip} ${item.proxy.port} ${item.country ? item.country : 'Unknown'} ${item.speed} ${
                    item.status
                }`;
                return properties.includes(query);
            })
        );
        setSearchValue(query);
    };

    const toggleModal = () => {
        setShowModal(!showModal);
    };

    const handleDelete = () => {
        if (activeCount === 0) {
            deleteAllProxies();
        } else {
            proxyList.forEach((item: ProxyWrapper) => {
                if (item.active) {
                    deleteProxy(item.proxy.id);
                }
            });
        }
    };

    const testProxies = async () => {
        const updatedList: ProxyWrapper[] = [];

        await Promise.all(
            proxyList.map(async (item) => {
                const result = await testProxy(testWebsite, item.proxy);

                updatedList.push({ ...item, speed: result.speed, country: result.country, status: result.status });
            })
        );

        setProxyList(updatedList);
    };

    const cleanProxies = async () => {
        const updatedList: ProxyWrapper[] = proxyList.filter((proxy: any) => proxy.speed < 2000);

        // updateProxyList(updatedList);
        setProxyList(updatedList);
    };

    const proxiesColumns = [
        { name: 'No', width: '8.33333%' },
        { name: 'Group', width: '25%' },
        { name: 'Host', width: '25%' },
        { name: 'Port', width: '8.33333%' },
        { name: 'Country', width: '16.6667%' },
        { name: 'Speed', width: '8.33333%' },
        { name: 'Status', width: '8.33333%' },
    ];

    return (
        <div className="content-box proxies-page-content-box" id="proxies">
            <div className="proxies-page-react-container" id="proxies-page-react-container">
                <div className="table-page-layout-root">
                    <div className="table-page-layout-table-container">
                        <div className="table-page-layout-table-container-header">
                            <Button
                                primary
                                onClick={() => toggleModal()}
                                icon={<div className="icon-component-green-plus" style={{ height: '13px', width: '13px' }} />}>
                                Create Proxies
                            </Button>
                            <Search placeholder="Search..." value={searchValue} onChange={(query) => searchProxies(query)} />
                        </div>
                        <Table columns={proxiesColumns}>
                            {displayProxyList?.map((proxy: ProxyWrapper, index: number) => (
                                <ProxiesItem
                                    key={proxy.proxy.id}
                                    proxyWrapper={proxy}
                                    index={index}
                                    columns={proxiesColumns}
                                    onItemClick={() => toggleProxy(proxy.proxy.id)}
                                />
                            ))}
                        </Table>
                    </div>
                    <div className="table-page-layout-bottom-bar">
                        <div className="table-page-layout-bottom-bar-left">
                            <Button theme="divided" onClick={handleDelete} icon={<Icon icon={Icons.TrashCan} />}>
                                Delete {countDisplay}
                            </Button>
                        </div>

                        <div className="table-page-layout-bottom-bar-center">
                            <div style={{ display: 'flex', marginTop: '2px', textOverflow: 'ellipsis' }}>
                                <PreviousNextButton
                                    rotate={0}
                                    onClick={() => {
                                        const i = testWebsites.indexOf(testWebsite);
                                        setTestWebsite(testWebsites[i - 1] || testWebsites[testWebsites.length - 1]);
                                    }}>
                                    <img alt="Next" src={Next} />
                                </PreviousNextButton>
                                <div style={{ width: '80px', textAlign: 'center', marginTop: '1px' }}>{testWebsite}</div>
                                <PreviousNextButton
                                    rotate={1}
                                    onClick={() => {
                                        const i = testWebsites.indexOf(testWebsite);
                                        setTestWebsite(testWebsites[i + 1] || testWebsites[0]);
                                    }}>
                                    <img alt="Next" src={Next} />
                                </PreviousNextButton>
                            </div>

                            <div className="button-component-divided-container">
                                <Button theme="divided" onClick={testProxies} icon={<Icon icon={Icons.Play} />}>
                                    Test {countDisplay}
                                </Button>
                            </div>
                        </div>

                        <div className="table-page-layout-bottom-bar-right">
                            <Button theme="divided" onClick={cleanProxies} icon={<Icon icon={Icons.Broom} />}>
                                Clean {countDisplay}
                            </Button>
                        </div>
                    </div>
                    <ProxiesModal show={showModal} onHide={() => toggleModal()} addProxies={addProxyList} />
                </div>
            </div>
        </div>
    );
};

const PreviousNextButton = styled.div<{ rotate: number }>`
    border: none;

    height: 30px;
    width: 30px;
    text-align: center;

    img {
        cursor: pointer;
        ${({ rotate }) => (rotate ? 'transform: translateX(-1px) rotate(180deg);' : '')}
    }

    transition: 0.15s all ease-in-out;

    &:hover {
        cursor: pointer;
        -webkit-filter: brightness(92%);
    }
`;

export default Proxies;
