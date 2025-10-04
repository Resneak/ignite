import { Reducer } from 'redux';

import Task from '../../lib/models/task';
import { ADD_TASK, DELETE_ALL_TASKS, DELETE_TASK, TaskAction, UPDATE_TASK } from '../actions/taskActions';

export interface TaskState {
    readonly tasks: Task[];
    readonly taskId?: string;
}

const defaultState: TaskState = {
    tasks: [],
};

export const taskReducer: Reducer<TaskState, TaskAction> = (state = defaultState, action: TaskAction) => {
    switch (action.type) {
        case ADD_TASK:
            return {
                ...state,
                tasks: [...state.tasks, action.task],
            };
        case DELETE_ALL_TASKS:
            return {
                ...state,
                tasks: [],
            };
        case DELETE_TASK:
            return {
                ...state,
                tasks: state.tasks.filter((task) => task.id !== action.id),
            };
        case UPDATE_TASK:
            return {
                ...state,
                tasks: state.tasks.map((task) => {
                    return task.id === action.task.id ? action.task : task;
                }),
            };
        default:
            return state;
    }
};
