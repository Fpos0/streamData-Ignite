import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';
import { api } from '../services/api';
import * as AuthSession from 'expo-auth-session'

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

interface AuthResponse {
  params: {
    access_token: string;
    error: string;
    state: string;
  };
  type: string;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  const { CLIENT_ID } = process.env;


  async function signIn() {
    try {

      setIsLoggingIn(true);

      const redirect_uri = makeRedirectUri({ useProxy: true });

      const response_type = 'token';

      const scope = encodeURI('openid user:read:email user:read:follows');

      const force_verify = true;

      const state = generateRandom(30);

      const authUrl = twitchEndpoints.authorization +
        `?client_id=${CLIENT_ID}` +
        `&redirect_uri=${redirect_uri}` +
        `&response_type=${response_type}` +
        `&scope=${scope}` +
        `&force_verify=${force_verify}` +
        `&state=${state}`;

      const { type, params } = await AuthSession
        .startAsync({ authUrl }) as AuthResponse;



      if (type === 'success' && params.error !== 'access_denied') {

        if (params.state !== state) {
          throw 'Invalid state value';
        }

        api.defaults.headers.authorization = `Bearer ${params.access_token}`

        const userResponse = await api.get('/users');

        setUser(userResponse.data.data[0]);

        setUserToken(params.access_token);
      }





    } catch (error) {
      throw new Error(error)
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true);

      await AuthSession.revokeAsync(
        {
          token: userToken,
          clientId: CLIENT_ID
        },
        { revocationEndpoint: twitchEndpoints.revocation }
      );
    } catch (error) {
    } finally {
      setUser({} as User)
      setUserToken('')
      delete api.defaults.headers.authorization;
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    api.defaults.headers['Client-Id'] = CLIENT_ID;
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
