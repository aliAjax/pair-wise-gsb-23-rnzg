// 判定层与数据层之间的用例编排：页面层只调这里，不直接拼装规则与快照。

import { repo } from "../data/repository";
import { evaluate } from "./pressureRules";
import type { Conflict, PassageApplication } from "../data/types";

/** 提交通行申请：按当前房间登记与缓冲间人数判定，命中规则则停在待复核 */
export function submitPassage(input: {
  roomRefId: string;
  applicant: string;
}): { application: PassageApplication; conflicts: Conflict[] } {
  const room = repo.getRoom(input.roomRefId);
  if (!room) throw new Error("房间登记不存在");
  const airlock = repo.getAirlock(room.airlockId);
  if (!airlock) throw new Error("缓冲间不存在");

  const conflicts = evaluate(room, airlock);
  const application = repo.createApplication({
    roomRefId: room.id,
    applicant: input.applicant,
    conflicts,
  });
  return { application, conflicts };
}

export function releaseAfterReview(input: {
  applicationId: string;
  basis: string;
  reviewer: string;
}): PassageApplication {
  return repo.releaseApplication(input);
}

export function handoverToNextShift() {
  return repo.advanceShift();
}
