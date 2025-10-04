import { Action, ActionCreator } from 'redux';
import Task from '../../lib/models/task';

// action constants
export const ADD_TASK = 'ADD_TASK';
export const DELETE_ALL_TASKS = 'DELETE_ALL_TASKS';
export const DELETE_TASK = 'DELETE_TASK';
export const UPDATE_TASK = 'UPDATE_TASK';

// action interfaces
export interface AddTaskAction extends Action {
    type: 'ADD_TASK';
    task: Task;
}
export interface DeleteAllTasksAction extends Action {
    type: 'DELETE_ALL_TASKS';
}
export interface DeleteTaskAction extends Action {
    type: 'DELETE_TASK';
    id: string;
}
export interface UpdateTaskAction extends Action {
    type: 'UPDATE_TASK';
    task: Task;
}

// action creators
export const addTask: ActionCreator<AddTaskAction> = (task: Task) => ({
    type: ADD_TASK,
    task,
});
export const deleteAllTasks: ActionCreator<DeleteAllTasksAction> = () => ({
    type: DELETE_ALL_TASKS,
});
export const deleteTask: ActionCreator<DeleteTaskAction> = (id: string) => ({
    type: DELETE_TASK,
    id,
});
export const updateTask: ActionCreator<UpdateTaskAction> = (task: Task) => ({
    type: UPDATE_TASK,
    task,
});

// action type
export type TaskAction = AddTaskAction | DeleteAllTasksAction | DeleteTaskAction | UpdateTaskAction;
