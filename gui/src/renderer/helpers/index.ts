import { v1, v4 } from 'uuid';

// Created from the system clock (plus random values)
export const genUuid = () => v1();

// created from cryptographically-strong random values
export const genGuuid = () => v4();
