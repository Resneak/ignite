import * as React from 'React';
import { useState } from 'react';

import Play from '../../shared/Icons/Play';
import Edit from '../../shared/Icons/Edit';
import TrashCan from '../../shared/Icons/TrashCan';

import './TasksItem.scss';

import Task from '../../../../lib/models/task';
import Profile from '../../../../../../lib/models/profile';
import ProxyList from '../../../../lib/models/proxyList';
// import websites from '../../../../../../bot/src/websites'; 
import Stop from '../../shared/Icons/Stop';
// import { CompletionType } from '../../../../../../lib/errors'
// import { showNotification } from '../../../../lib/helpers/notifications';
// import icon from '../../../../../lib/assets/logo.png';
import { TaskStatusColor } from '../../../../../../lib/models/taskUpdate';
import Logger from '../../../../main/logger';
import Purchase from '../../../../lib/models/purchase';
// import { genGuuid } from '../../../helpers';
// import DiscordWebhook from '../../../services/discord';
// import TaskManager from '../../../../../../bot/src';

interface Props {
    task: Task;
    profile: Profile;
    discordWebhookUrl?: string;
    proxyList?: ProxyList;
    index: number;
    onItemClick: () => void;
    onEdit: Function;
    onDelete: Function;
    onAddPurchase: (purchase: Purchase) => void;
}

// const showPaymentNotification = (type: CompletionType) => {
//     if (type === CompletionType.PaymentSuccess) {
//         showNotification({
//             icon,
//             body: 'Payment successful!',
//         });
//     } else if (type === CompletionType.PaymentDeclined) {
//         showNotification({
//             icon,
//             body: 'Payment declined :(',
//         });
//     }
// };

const toCssColor = (statusColor: TaskStatusColor) => {
    switch (statusColor) {
        case TaskStatusColor.Error:
            return 'text-danger';
        case TaskStatusColor.Success:
            return 'text-success';
        case TaskStatusColor.Info:
            return 'text-info';
        case TaskStatusColor.Warning:
            return 'text-warning';
        case TaskStatusColor.Neutral:
            return 'text-white';
        default:
            Logger.error(`unknown TaskStatusColor with index ${statusColor} and value ${TaskStatusColor[statusColor]}`);
            return 'text-white';
    }
};

const TaskItem: React.FC<Props> = ({ task, profile, discordWebhookUrl, proxyList, index, onItemClick, onEdit, onDelete, onAddPurchase }: Props) => {
    const [status, setStatus] = useState('Idle');
    const [statusColor, setStatusColor] = useState(TaskStatusColor.Neutral);
    const [isRunning, setIsRunning] = useState(false);

    // const website = websites.find((w) => w.name === task.websiteName);
    // delete task if website doesn't exist anymore
    // if (website == null) onDelete();



    // const botTask = website!.createBotTask({ 
    //     profile,
    //     task,
    //     proxies: proxyList?.proxies,
    //     setStatus: (newStatus: string, color?: TaskStatusColor) => {
    //         setStatus(newStatus);
    //         setStatusColor(color || TaskStatusColor.Neutral);
    //     },
    //     onComplete: async (type, finishedBotTask) => {
    //         if (discordWebhookUrl != null && type !== CompletionType.None) {
    //             const discordWebhook = new DiscordWebhook(discordWebhookUrl);
    //             try {
    //                 await discordWebhook.notifyCheckout(type, finishedBotTask);
    //             } catch (ex) {
    //                 Logger.info(ex);
    //             }
    //         }
    //         showPaymentNotification(type); // TODO: only send notif if all tasks completed to avoid spam
    //         setIsRunning(false);
    //         onAddPurchase(
    //             new Purchase({
    //                 id: genGuuid(),
    //                 dateInMilliseconds: Date.now(),
    //                 product: finishedBotTask.task.product,
    //                 type,
    //                 websiteName: finishedBotTask.task.websiteName,
    //             })
    //         );
    //     },
    // });

    const classes = task.isActive ? 'table-component-data-row-content table-component-data-row-content-selected' : 'table-component-data-row-content';

    return (
        <div className={classes} onClick={() => onItemClick()} role="button">
            <div className="table-component-data-cell task-col-0">{index + 1}</div>
            <div className="table-component-data-cell task-col-1">{task.websiteName}</div>
            <div className="table-component-data-cell task-col-2">Fast</div>
            <div className="table-component-data-cell task-col-3">{task.product.name}</div>
            <div className="table-component-data-cell task-col-4">{task.product.variant.size.name}</div>
            <div className="table-component-data-cell task-col-5">{profile?.name}</div>
            <div className="table-component-data-cell task-col-6">
                <div>{proxyList?.name}</div>
            </div>
            <div className="table-component-data-cell task-col-7">
                <div className={toCssColor(statusColor)}>{status === 'Idle' ? `● Idle` : status}</div>
            </div>
            <div className="table-component-data-cell task-col-8" role="button" onClick={(e) => e.stopPropagation()}>
                <div className="task-table-action-buttons">
                    {!isRunning && (
                        <div
                            className="tasks-table-action-button tasks-table-start-button"
                            role="button"
                            onClick={() => {
                                // botTask.start();
                                setIsRunning(true);
                            }}>
                            <Play className="tasks-table-action-button-icon" />
                        </div>
                    )}
                    {isRunning && (
                        <div
                            className="tasks-table-action-button tasks-table-start-button"
                            role="button"
                            onClick={() => {
                                // botTask.stop(true);
                                setIsRunning(false);
                            }}>
                            <Stop className="tasks-table-action-button-icon" />
                        </div>
                    )}
                    <div className="tasks-table-action-button tasks-table-edit-button" role="button" onClick={() => onEdit()}>
                        <Edit className="tasks-table-action-button-icon" />
                    </div>
                    <div className="tasks-table-action-button tasks-table-delete-button" role="button" onClick={() => onDelete()}>
                        <TrashCan className="tasks-table-action-button-icon" />
                    </div>
                </div>
            </div>
        </div>
    );
};
export default TaskItem;
