import State from '../../gui/src/lib/models/state';

export default class Country {
  name: string;

  code: string;

  states: State[];

  constructor(code: string, name: string, states: State[]) {
    this.code = code;
    this.name = name;
    this.states = states;
  }
}
