import { Bootstrap, Injectable } from "../../config/bootstrap";
import { BaseRepository } from "../base.repository";
import { AIAgent } from "../../../model/ai.model";

@Injectable()
@Bootstrap()
export class AgentRepository extends BaseRepository {
    constructor() {
        super('agent');
    }

    getAll(networkId: string, limit?: number): Promise<AIAgent[]> {
        return this.context.find({ networkId: networkId }, { embedding: 0 }, limit ? { limit: limit } : undefined);
    }

    getAgent(oid: string) {
        return super.getByObjectId<AIAgent>(oid);
    }

    update(agent: AIAgent) {
        //console.log(`updating agent ${agent.oid}`);
        const obj = <any>{ ...agent };
        delete obj.conversation;
        delete obj._conversation;
        delete obj.systemContext;

        delete obj.edges;
        return super.updateObject<AIAgent>(obj);
    }
}