export interface IAgreement {
  defaultValue: boolean;
  displayInSetting: boolean;
  required: boolean;
  since: string;
  editable: boolean;
  disabled: boolean;
  title: string;
  label: string;
  description?: string;
}

export interface IAgreementSpec {
  [key: string]: IAgreement;
}
