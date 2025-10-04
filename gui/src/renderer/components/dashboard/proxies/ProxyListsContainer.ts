import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import {
    addProxyList,
    deleteAllProxies,
    deleteProxy,
    ProxyListAction,
    updateProxyList
} from '../../../actions/proxyListActions';
import ProxyList from '../../../../lib/models/proxyList';
import Proxies from './Proxies';
import { RootState } from '../../../reducers';

const mapStateToProps = (state: RootState) => ({
    proxyLists: state.proxy.proxyLists,
});

const mapDispatchToProps = (dispatch: Dispatch<ProxyListAction>) => ({
    addProxyList: (proxyList: ProxyList) => dispatch(addProxyList(proxyList)),
    deleteAllProxies: () => dispatch(deleteAllProxies()),
    deleteProxy: (id: string) => dispatch(deleteProxy(id)),
    updateProxyList: (proxyList: ProxyList) => dispatch(updateProxyList(proxyList)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Proxies);
