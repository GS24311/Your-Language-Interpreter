export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  traitProfile: {
    attachmentStyle: string;
    communicationStyle: string;
    triggers: string[];
    notes: string;
    advice?: string;
  };
  settings?: {
    realTimeCoaching: boolean;
    shareAnonymousData: boolean;
  };
  createdAt: any;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  partnerName?: string;
  status: 'active' | 'resolved';
  lastMessageAt: any;
  createdAt: any;
}

export interface Message {
  id: string;
  role: 'user' | 'partner';
  senderName?: string;
  content: string;
  order?: number;
  createdAt: any;
  analysis?: {
    emotion: string;
    intent: string;
    advice: string;
    mistakeFilter: string;
  };
}
