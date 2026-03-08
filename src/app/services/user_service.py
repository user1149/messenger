from typing import List, Dict, Optional
from app.repositories.user_repository import UserRepository

class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    def search_users(self, current_user_id: int, query: str) -> List[Dict]:
        users = self.user_repo.search_users(current_user_id, query)
        return [{'id': u.id, 'username': u.username} for u in users]

    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return None
        return {'id': user.id, 'username': user.username}
