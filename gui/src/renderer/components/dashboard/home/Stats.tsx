import * as React from 'React';
import { useSelector } from 'react-redux';
import { RootState } from '../../../reducers';

import './Stats.scss';
// import TaskManager, { TaskState } from '../../../../lib/taskManager';

// const taskManager = TaskManager.getInstance(); //TODO integrate task manager

const Stats = () => {
    const proxies = useSelector((state: RootState) => state.proxy.proxyLists);
    const profiles = useSelector((state: RootState) => state.profile.profiles);
    const tasks = useSelector((state: RootState) => state.task.tasks);
    // const activeTasks = taskManager.getAll(TaskState.Starting); // TODO: update active tasks live? (store in statistics redux obj)

    return (
        <div className="dashboard-bottom-row-item dashboard-purchase-stats">
            <div className="dashboard-bottom-row-item-title">Total Amount</div>
            <div className="dashboard-bottom-row-item-content">
                <div className="dashboard-stats-grid">
                    <StatsItem value={proxies.map((pl) => pl.proxies).flat().length} title="Proxies" />
                    <StatsItem value={profiles.length} title="Profiles" />
                    <StatsItem value={tasks.length} title="Tasks" />
                    {/* <StatsItem value={activeTasks.length} title="Active Tasks" /> */}
                </div>
            </div>
        </div>
    );
};

export default Stats;

interface StatsItemProps {
    value: number;
    title: string;
}

const StatsItem = ({ value, title }: StatsItemProps) => {
    return (
        <div className="dashboard-stat">
            <div className="dashboard-stat-value">{value}</div>
            <div className="dashboard-stat-title">{title}</div>
        </div>
    );
};
