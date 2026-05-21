import { RoleType } from 'src/common/enums/role-type.enum';

export interface Payload {
  sub: number;
  role: RoleType | null; // 🔥 incluir rol para evitar query a DB en cada request
}
