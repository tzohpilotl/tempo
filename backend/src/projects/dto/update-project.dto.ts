import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project name cannot be empty' })
  @MaxLength(100, { message: 'Project name cannot exceed 100 characters' })
  name: string;
}
