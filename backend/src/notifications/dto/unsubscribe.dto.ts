import { IsString, IsNotEmpty } from 'class-validator';

export class UnsubscribeDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;
}
