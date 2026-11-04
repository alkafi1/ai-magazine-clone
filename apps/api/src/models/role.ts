import { Schema, model } from 'mongoose';

/** Custom roles (the built-in ones live in code, see packages/shared/src/rbac.ts). */
const roleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    rank: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true },
);
export const Role = model('Role', roleSchema);
