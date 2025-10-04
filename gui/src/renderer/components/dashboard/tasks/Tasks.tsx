import * as React from 'React';
import styled from 'styled-components';
import { useEffect, useState } from 'react';
import { ipcRenderer, remote } from 'electron';

import IpcChannel from '../../../../main/ipc';

import './Tasks.scss';

import Button from '../../shared/Button';
import Search from '../../shared/Search';
import TasksModal from './TasksModal';
import Table from '../../shared/Table';
import Logger from '../../../../main/logger';

import Icon, { Icons } from '../../shared/Icons/Icon';
import Task from '../../../../lib/models/task';
import ProxyList from '../../../../lib/models/proxyList';
import Profile from '../../../../../../lib/models/profile';
import TasksItem from './TasksItem';
import Purchase from '../../../../lib/models/purchase';

interface Props {
    profiles: Profile[];
    proxyLists: ProxyList[];
    tasks: Task[];
    discordWebhookUrl?: string;
    addTask: (task: Task) => void;
    deleteAllTasks: () => void;
    deleteTask: (id: string) => void;
    updateTask: (task: Task) => void;
    addPurchase: (purchase: Purchase) => void;
}

const Tasks = ({ profiles, proxyLists, tasks, discordWebhookUrl, addTask, deleteTask, deleteAllTasks, updateTask, addPurchase }: Props) => {
    const { dialog } = remote;

    const [autoSolveInt /*setAutoSolveInt */] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [taskList, setTaskList] = useState<Task[]>([]);
    const [taskListDisplay, setTaskListDisplay] = useState<Task[]>(taskList);
    const [runningTasks /* setRunningTasks */] = useState([]);
    const [activeCount, setActiveCount] = useState('All');
    const [currentTask, setCurrentTask] = useState<Task | undefined>();

    const [currentTime, setCurrentTime] = useState(new Date(Date.now() + 500).toLocaleString().split(',')[1]);

    const timeController = setInterval(() => {
        setCurrentTime(new Date(Date.now() + 500).toLocaleString().split(',')[1]);
    }, 500);

    useEffect(() => {
        setTaskList(tasks);

        return () => clearInterval(timeController);
    }, [tasks]);

    useEffect(() => {
        const count = taskList.filter((item) => item.isActive).length;
        setActiveCount(count > 0 ? `(${count})` : 'All');
        setTaskListDisplay(taskList);
    }, [taskList]);

    const importTasks = async () => {
        // const { filePaths, canceled } = await dialog.showOpenDialog({
        //     buttonLabel: 'Import',
        //     properties: ['openFile', 'multiSelections'],
        //     filters: [{ name: 'JSON Files', extensions: ['json'] }],
        //     title: 'Import Tasks',
        // });
        // if (canceled) return;
        // filePaths.forEach((filePath) => {
        //     let data = '';
        //     fs.createReadStream(filePath, 'utf8')
        //         .on('data', (chunk) => {
        //             data += chunk;
        //         })
        //         .on('error', (err) => {
        //             Logger.info(`Error reading tasks from file ${err}`);
        //         })
        //         .on('end', () => {
        //             const jsonTasks = JSON.parse(data);
        //             // TODO parse tasks -> Should include full profiles, proxies and tasks
        //             // jsonTasks.forEach((item: Task) => {
        //             //     const task = new Task(item);
        //             //     addTask(task);
        //             // });
        //         });
        // });
    };

    const exportTasks = async () => {
        const { filePath, canceled } = await dialog.showSaveDialog({
            title: 'Export Tasks',
            buttonLabel: 'Export',
            defaultPath: 'tasks.json',
            properties: ['createDirectory', 'showOverwriteConfirmation'],
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
        });
        if (canceled) return;
        if (filePath) {
            // TODO write to file full tasks, profiles and proxies -> create toString functions for each
            // await fs.writeFile(filePath, JSON.stringify(tasks), (err) => {
            //     if (err) {
            //         Logger.log(`Error writing task: ${err}`);
            //     }
            // });
        }
    };

    const toggleTask = (id: string) => {
        const updatedList: Task[] = [];
        taskList.forEach((item: Task) => {
            const temp = item;
            if (item.id === id) {
                temp.isActive = !item.isActive;
                updatedList.push(temp);
                setCurrentTask(temp.isActive ? item : undefined);
            } else {
                temp.isActive = false;
                updatedList.push(item);
            }
        });
        setTaskList(updatedList);
    };

    const searchTasks = (query: string) => {
        setTaskListDisplay(
            taskList.filter((item) => {
                const profile = profiles.find((p) => p.id === item.profileId);
                const proxyList = proxyLists.find((pl) => pl.id === item.proxyListId);
                const properties = `${item.websiteName} ${item.product.name} ${item.product.variant.size.name} ${profile?.name} ${proxyList?.name}`;
                return properties.includes(query);
            })
        );
        setSearchValue(query);
    };

    const toggleModal = () => setShowModal(!showModal);

    const handleDelete = () => {
        if (currentTask) {
            deleteTask(currentTask.id);
        } else {
            deleteAllTasks();
        }
    };

    const tasksColumns = [
        { name: '', width: '5.06061%' },
        { name: 'Store', width: '9.09091%' },
        { name: 'Mode', width: '12.2424%' },
        { name: 'Product', width: '12%' },
        { name: 'Size', width: '11%' },
        { name: 'Profile', width: '12.1212%' },
        { name: 'Proxies', width: '12.1212%' },
        { name: 'Status', width: '13.6364%' },
        { name: 'Actions', width: '13.6364%' },
    ];

    return (
        <div className="content-box tasks-page-content-box" id="task">
            <div id="tasks-page-react-container" className="tasks-page-react-container">
                <div className="tasks-page">
                    <div className="tasks-task-list">
                        <div className="tasks-task-list-header">
                            <div className="tasks-task-list-header-left">
                                <button
                                    className="tasks-task-list-header-button tasks-task-list-header-button-primary"
                                    onClick={() => {
                                        toggleTask('');
                                        setCurrentTask(undefined);
                                        toggleModal();
                                    }}>
                                    <div className="tasks-button-icon tasks-new-icon-green" />
                                    New Task
                                </button>
                                <button className="tasks-task-list-header-button" onClick={importTasks}>
                                    <div className="tasks-button-icon tasks-import-icon" />
                                    Import
                                </button>
                                <button className="tasks-task-list-header-button" onClick={exportTasks}>
                                    <div className="tasks-button-icon tasks-export-icon" />
                                    Export
                                </button>
                            </div>
                            <div className="tasks-task-list-header-right">
                                <Search placeholder="Search..." value={searchValue} onChange={searchTasks} />
                            </div>
                        </div>
                        <Table columns={tasksColumns}>
                            {taskListDisplay?.map((task: Task, index: number) => {
                                const profile = profiles.find((p) => p.id === task.profileId);
                                const proxyList = task.proxyListId != null ? proxyLists.find((p) => p.id === task.proxyListId) : undefined;

                                // remove faulty tasks
                                if (profile == null) deleteTask(task.id);

                                return (
                                    <TasksItem
                                        key={task.id}
                                        task={task}
                                        profile={profile!}
                                        proxyList={proxyList}
                                        index={index}
                                        onItemClick={() => toggleTask(task.id)}
                                        onEdit={() => {
                                            if (!currentTask || currentTask.id !== task.id) {
                                                toggleTask(task.id);
                                            }
                                            toggleModal();
                                        }}
                                        onDelete={() => deleteTask(task.id)}
                                        onAddPurchase={addPurchase}
                                        discordWebhookUrl={discordWebhookUrl}
                                    />
                                );
                            })}
                        </Table>
                    </div>
                    <div style={{ display: 'flex' }}>
                        <GreenDot active={true} />
                        <Time>{currentTime}</Time>
                        <GreenDot active={autoSolveInt} />
                        <AutoSolve>AYCD AutoSolve</AutoSolve>
                    </div>
                    <div className="tasks-bottom-bar">
                        <div className="tasks-bottom-bar-section tasks-bottom-bar-section-left">
                            <div className="tasks-bottom-bar-divided">
                                <div className="tasks-bottom-bar-button tasks-bottom-bar-divided-left">
                                    <Button disabled={!currentTask} theme="divided" onClick={toggleModal} icon={<Icon icon={Icons.Edit} />}>
                                        Edit
                                    </Button>
                                </div>
                                <div className="tasks-bottom-bar-divider" />
                                <div className="tasks-bottom-bar-button tasks-bottom-bar-divided-right">
                                    <Button theme="divided" onClick={handleDelete} icon={<Icon icon={Icons.TrashCan} />}>
                                        Delete {activeCount}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="tasks-bottom-bar-section tasks-bottom-bar-section-center">
                            <div className="tasks-bottom-bar-divided">
                                <div className="tasks-bottom-bar-button tasks-bottom-bar-divided-left">
                                    <Button theme="divided" onClick={() => Logger.info('handle start')} icon={<Icon icon={Icons.Play} />}>
                                        Start {activeCount}
                                    </Button>
                                </div>
                                <div className="tasks-bottom-bar-divider" />
                                <div className="tasks-bottom-bar-button tasks-bottom-bar-divided-right">
                                    <Button
                                        theme="divided"
                                        onClick={() => Logger.info('handle stop')}
                                        icon={<Icon icon={Icons.Stop} />}
                                        disabled={runningTasks.length === 0}>
                                        Stop {activeCount}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="tasks-bottom-bar-section tasks-bottom-bar-section-right">
                            <Button theme="divided" onClick={() => ipcRenderer.send(IpcChannel.HarvesterNew)} icon={<Icon icon={Icons.Captcha} />}>
                                Captcha
                            </Button>
                        </div>
                    </div>
                    <TasksModal
                        show={showModal}
                        onHide={toggleModal}
                        addTask={(task: Task) => addTask(task)}
                        updateTask={(task: Task) => updateTask(task)}
                        task={currentTask}
                        profiles={profiles}
                        proxies={proxyLists}
                    />
                </div>
            </div>
        </div>
    );
};

export default Tasks;

const GreenDot = styled.div<{ active: boolean }>`
    height: 11px;
    width: 11px;
    background-color: ${({ active }) => (active ? '#29c871' : '#BE2A50')};
    border-radius: 50%;

    margin-left: 40px;
    margin-top: 9px;
`;

const Time = styled.div`
    font-weight: 400;
    font-size: 18px;

    margin-left: 10px;
    margin-right: 74%;
    margin-bottom: 8px;
`;

const AutoSolve = styled.div`
    font-weight: 400;
    font-size: 16px;

    margin-left: 10px;
    padding-top: 2px;
`;
