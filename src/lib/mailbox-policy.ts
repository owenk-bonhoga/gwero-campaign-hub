export type MailboxRelationship = { isOwner: boolean; canSend: boolean };

export function mailboxActions(relationship: MailboxRelationship) {
  return {
    canUseForSending: relationship.isOwner || relationship.canSend,
    canEdit: relationship.isOwner,
    canDelete: relationship.isOwner,
    canTest: relationship.isOwner,
    canShare: relationship.isOwner,
  };
}

export function shouldRequireEmailSetup(ownedSendingAccountCount: number) {
  return ownedSendingAccountCount < 1;
}

export function canDeleteOwnedMailbox(ownedAccountCount: number) {
  return ownedAccountCount > 1;
}
