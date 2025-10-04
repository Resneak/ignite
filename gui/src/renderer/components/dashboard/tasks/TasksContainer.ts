import { connect } from 'react-redux';
import { Dispatch } from 'react';
import { RootState } from '../../../reducers';
import Tasks from './Tasks';
import { addTask, deleteAllTasks, deleteTask, TaskAction, updateTask } from '../../../actions/taskActions';
import Task from '../../../../lib/models/task';
import Purchase from '../../../../lib/models/purchase';
import { addPurchase, PurchaseAction } from '../../../actions/statisticsAction';

const mapStateToProps = (state: RootState) => ({
    profiles: state.profile.profiles,
    proxyLists: state.proxy.proxyLists,
    tasks: state.task.tasks,
    discordWebhookUrl: state.settings.discordWebhookUrl,
});

const mapDispatchToProps = (dispatch: Dispatch<TaskAction | PurchaseAction>) => ({
    addTask: (task: Task) => dispatch(addTask(task)),
    deleteAllTasks: () => dispatch(deleteAllTasks()),
    deleteTask: (id: string) => dispatch(deleteTask(id)),
    updateTask: (task: Task) => dispatch(updateTask(task)),
    addPurchase: (purchase: Purchase) => dispatch(addPurchase(purchase)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Tasks);
