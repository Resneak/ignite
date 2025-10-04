import { connect } from 'react-redux';
import { Dispatch } from 'react';
import { RootState } from '../reducers';
import Application from './Application';
import { loginUser, logoutUser, UserAction } from '../actions/userActions';
import User from '../../../../lib/models/user';

const mapStateToProps = (state: RootState) => ({
    account: state.user.account,
});

const mapDispatchToProps = (dispatch: Dispatch<UserAction>) => ({
    login: (user: User) => dispatch(loginUser(user)),
    logout: () => dispatch(logoutUser()),
});

export default connect(mapStateToProps, mapDispatchToProps)(Application);
