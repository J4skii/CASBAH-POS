export async function authenticate(req, reply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorised' })
  }
}

export function requireRole(...roles) {
  return async (req, reply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorised' })
    }
    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
  }
}
