import { RoleType } from '../../../common/enums/role-type.enum';

export interface Payload {
  sub: number;
  role: RoleType | null; // 🔥 incluir rol para evitar query a DB en cada request
}
