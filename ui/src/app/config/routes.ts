import { RouteInfo } from 'bundle/service';

export class Route {
    static Agent: RouteInfo = { path: 'agent/:agentId' };
    static Network: RouteInfo = { path: 'network/:networkId' };
}