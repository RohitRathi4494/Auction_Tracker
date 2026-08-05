import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { hashPassword } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const usersSnap = await adminDb.collection('users').get();
    const users = usersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username,
        role: data.role,
        teamId: data.teamId,
        createdAt: data.createdAt,
      };
    });
    
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, teamId } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    
    // Check if user already exists
    const userRef = adminDb.collection('users').doc(cleanUsername);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }
    
    // Hash password
    const passwordHash = hashPassword(password);
    
    const newUser = {
      username: cleanUsername,
      passwordHash,
      role: 'owner',
      teamId: teamId || null,
      createdAt: new Date().toISOString(),
    };
    
    await userRef.set(newUser);
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: cleanUsername,
        username: newUser.username,
        role: newUser.role,
        teamId: newUser.teamId,
        createdAt: newUser.createdAt,
      } 
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    
    await adminDb.collection('users').doc(username.toLowerCase()).delete();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}

// PATCH — admin resets password or updates assigned team
export async function PATCH(req: NextRequest) {
  try {
    const { username, newPassword, teamId } = await req.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(username.toLowerCase());
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updates.passwordHash = hashPassword(newPassword);
    }

    if (teamId !== undefined) {
      updates.teamId = teamId || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await userRef.update(updates);

    return NextResponse.json({ success: true, message: `User ${username} updated successfully.` });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

