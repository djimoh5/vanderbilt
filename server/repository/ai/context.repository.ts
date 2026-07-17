import { Bootstrap, Injectable } from "../../config/bootstrap";
import { BaseRepository } from "../base.repository";
import { AIContext } from "../../../model/ai.model";

@Injectable()
@Bootstrap()
export class ContextRepository extends BaseRepository {
    constructor() {
        super('context');
    }

    getContext(oid: string) {
        return this.getByObjectId<AIContext>(oid);
    }

    getByNetworkId(networkId: string): Promise<AIContext[]> {
        return this.context.find({ networkId: networkId });
    }

    getContexts(oids: string[]) {
        return super.getByObjectIds<AIContext>(oids);
    }

    update(context: Partial<AIContext>) {
        console.log(`updating context ${JSON.stringify(context)}`);
        return super.updateObject<AIContext>(context);
    }
}