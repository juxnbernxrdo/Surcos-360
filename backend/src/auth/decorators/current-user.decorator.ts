import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: Record<string, unknown> }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    if (data === 'id') {
      const instPerson = user.institutionalPerson as
        { id?: string } | undefined;
      return instPerson?.id || user.id || user.userId;
    }

    if (data === 'userType') {
      const instPerson = user.institutionalPerson as
        { userType?: string } | undefined;
      return instPerson?.userType || user.userType;
    }

    return data ? user[data] : user;
  },
);
