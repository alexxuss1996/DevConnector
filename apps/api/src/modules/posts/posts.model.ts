import mongoose, { Schema, Types } from "mongoose";

interface IComment {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  name: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ILike {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
}

export interface IPost {
  userId: Types.ObjectId;
  name?: string;
  text: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
  likes: ILike[];
  comments: IComment[];
}

const postSchema = new Schema<IPost>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  likes: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
  ],
  comments: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      text: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      avatar: {
        type: String,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ "likes.userId": 1 });
postSchema.index({ "comments.userId": 1 });

const Post = mongoose.model<IPost>("Post", postSchema);

export default Post;
