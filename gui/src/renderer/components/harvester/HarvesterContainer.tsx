import { connect } from 'react-redux';
import { Dispatch } from 'react';
import { hot } from 'react-hot-loader/root';
import { RootState } from '../../reducers';

import HarvesterAccount from '../../../lib/models/harvesterAccount';
import { addAccount, deleteAccount, HarvesterAction, updateAccount } from '../../actions/harvesterActions';

import Harvester from './Harvester';

const mapStateToProps = (state: RootState) => ({
    accounts: state.harvester.accounts,
});

const mapDispatchToProps = (dispatch: Dispatch<HarvesterAction>) => ({
    addAccount: (account: HarvesterAccount) => dispatch(addAccount(account)),
    deleteAccount: (id: string) => dispatch(deleteAccount(id)),
    updateAccount: (account: HarvesterAccount) => dispatch(updateAccount(account)),
});

export default hot(connect(mapStateToProps, mapDispatchToProps)(Harvester));
