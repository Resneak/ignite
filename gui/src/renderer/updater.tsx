import * as React from 'react';
import { render } from 'react-dom';

import Updater from './components/updater/Updater';

// Create main element
const mainElement = document.createElement('div');
document.body.appendChild(mainElement);

render(<Updater />, mainElement);
