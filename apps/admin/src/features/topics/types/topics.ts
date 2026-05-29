export type TopicFormMode =
  | {
      kind: 'create'
    }
  | {
      id: string
      kind: 'edit'
    }
