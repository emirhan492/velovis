import { IsArray, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @IsArray()
  @IsUUID('all', { each: true }) // Dizideki her elemanın UUID olmasını sağlar
  roleIds: string[]; // ["uuid-of-admin-role", "uuid-of-moderator-role"]
}
