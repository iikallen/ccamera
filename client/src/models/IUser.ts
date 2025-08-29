export interface IUser {
  email: string;
  isActivated: boolean;
  id: string;
  username?: string;
  avatar?: string;
  role?: string;
  guest?: boolean;
}
