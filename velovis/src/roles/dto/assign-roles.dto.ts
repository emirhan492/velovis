import { IsArray, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @IsArray()
  @IsUUID('all', { each: true })
  roleIds: string[];
}
