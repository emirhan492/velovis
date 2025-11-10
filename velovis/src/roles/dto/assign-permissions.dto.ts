import { IsArray, IsString } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @IsString({ each: true }) // Dizideki her elemanın string olmasını sağlar
  permissionKeys: string[]; // ["products:create", "products:update"]
}
